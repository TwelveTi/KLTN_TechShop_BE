const AppError = require("../utils/AppError");
const behaviorRepository = require("../repositories/behaviorRepository");
const logger = require("../utils/logger");
const pricing = require("../utils/pricing");

const { BEHAVIOR_TYPES, SIGNAL_WEIGHTS } = require("../utils/behaviorSignals");

// Repeat views of the same product inside this window collapse into one event.
// Without it a page refresh (or a shopper comparing two tabs) would drown the
// signal in duplicates.
const VIEW_DEDUP_MINUTES = 30;

// Only the recent past shapes a profile: what someone wanted a year ago is not
// what they want today.
const PROFILE_WINDOW_DAYS = 90;

const TOP_N = 5;

class BehaviorService {
  /**
   * Record one event.
   *
   * NEVER throws. Tracking is a side observation of a request that has its own
   * job to do — a failed insert must not break browsing, adding to a cart, or
   * placing an order. Failures are logged and swallowed.
   */
  async track({ userId = null, sessionId = null, behaviorType, productId = null, categoryId = null, metadata = null }) {
    try {
      if (!BEHAVIOR_TYPES.includes(behaviorType)) {
        throw new Error(`Unknown behaviorType "${behaviorType}"`);
      }

      // An event with no identity at all cannot be attributed to anyone, so it
      // would only ever be noise.
      if (!userId && !sessionId) {
        return null;
      }

      if (behaviorType === "VIEW_PRODUCT" && (await this.isDuplicateView({ userId, sessionId, productId }))) {
        return null;
      }

      return await behaviorRepository.createBehavior({
        userId,
        sessionId,
        behaviorType,
        productId,
        categoryId,
        metadata,
        occurredAt: new Date(),
      });
    } catch (error) {
      logger.warn("Failed to record a user behaviour", {
        behaviorType,
        error: logger.serializeError(error),
      });
      return null;
    }
  }

  async isDuplicateView({ userId, sessionId, productId }) {
    if (!productId) {
      return false;
    }

    const since = new Date(Date.now() - VIEW_DEDUP_MINUTES * 60 * 1000);
    const recent = await behaviorRepository.findRecentBehavior({
      userId,
      sessionId,
      behaviorType: "VIEW_PRODUCT",
      productId,
      since,
    });

    return Boolean(recent);
  }

  /**
   * A search writes to both tables on purpose: `search_histories` powers the
   * "recent searches" UI and keyword analysis, `user_behaviors` is the event
   * log the recommender reads. See models.md 13.5.
   */
  async trackSearch({ userId = null, sessionId = null, keyword, categoryId = null, filters = null, resultCount = null }) {
    const trimmed = String(keyword || "").trim();

    if (!trimmed) {
      return null;
    }

    try {
      if (userId || sessionId) {
        await behaviorRepository.createSearchHistory({
          userId,
          sessionId,
          keyword: trimmed.slice(0, 255),
          categoryId,
          filters,
          resultCount,
          searchedAt: new Date(),
        });
      }
    } catch (error) {
      logger.warn("Failed to record a search history entry", { error: logger.serializeError(error) });
    }

    return this.track({
      userId,
      sessionId,
      behaviorType: "SEARCH",
      categoryId,
      metadata: { keyword: trimmed, filters, resultCount },
    });
  }

  // Purchases are recorded per line, AFTER the order transaction has committed.
  // Inside it, a tracking failure would roll back a paid-for order.
  async trackPurchase({ userId, sessionId = null, lines = [], orderId = null }) {
    for (const line of lines) {
      await this.track({
        userId,
        sessionId,
        behaviorType: "PURCHASE",
        productId: line.productId,
        categoryId: line.categoryId || null,
        metadata: { orderId, quantity: line.quantity, unitPrice: line.unitPrice },
      });
    }
  }

  // ── Client-reported events ────────────────────────────────────────────────

  // Only for what the server cannot observe itself, e.g. which recommendation
  // tile was clicked. Everything the backend already sees (views, searches,
  // cart adds, purchases) is recorded server-side, where it cannot be forged.
  async recordFromClient({ userId, sessionId, events }) {
    if (!userId && !sessionId) {
      throw new AppError("A session id is required to record activity", 400);
    }

    const accepted = [];

    for (const event of events) {
      const row = await this.track({
        userId,
        sessionId,
        behaviorType: event.behaviorType,
        productId: event.productId || null,
        categoryId: event.categoryId || null,
        metadata: event.metadata || null,
      });

      if (row) {
        accepted.push(row.id);
      }
    }

    return { received: events.length, recorded: accepted.length };
  }

  // ── Search history (read / clear) ─────────────────────────────────────────

  async getMySearchHistory(userId, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const { rows, count } = await behaviorRepository.findSearchHistoryByUser(userId, {
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: rows,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    };
  }

  async getMyRecentKeywords(userId, limit = 10) {
    const rows = await behaviorRepository.findDistinctKeywordsByUser(userId, Math.min(Math.max(limit, 1), 50));

    return rows.map((row) => ({ keyword: row.keyword, lastSearchedAt: row.lastSearchedAt }));
  }

  async clearMySearchHistory(userId) {
    return { deleted: await behaviorRepository.destroySearchHistoryByUser(userId) };
  }

  async deleteMySearchHistoryEntry(userId, id) {
    const deleted = await behaviorRepository.destroySearchHistoryById(id, userId);

    if (deleted === 0) {
      throw new AppError("Search history entry not found", 404);
    }

    return { deleted };
  }

  // ── Preference profile ────────────────────────────────────────────────────

  // Turn the raw event log into the weighted summary the recommender reads.
  // Recomputed on demand rather than on every event: a profile that is a few
  // minutes stale costs nothing, while writing it on every page view would put
  // an aggregate query in the hot path of browsing.
  async recomputeProfile(userId) {
    const since = new Date(Date.now() - PROFILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [categoryRows, productFacts] = await Promise.all([
      behaviorRepository.countBehaviorsByCategory(userId, { since }),
      behaviorRepository.findBehaviorProductFacts(userId, { since }),
    ]);

    const categoryScores = {};
    categoryRows.forEach((row) => {
      const weight = SIGNAL_WEIGHTS[row.behaviorType] || 1;
      categoryScores[row.categoryId] = (categoryScores[row.categoryId] || 0) + Number(row.total) * weight;
    });

    const brandScores = {};
    // Prices are collected only from the signals that imply real intent —
    // a glance at a flagship should not stretch someone's budget upward.
    const intentPrices = [];

    productFacts.forEach((row) => {
      const product = row.product;
      const weight = SIGNAL_WEIGHTS[row.behaviorType] || 1;

      if (product.brandId) {
        brandScores[product.brandId] = (brandScores[product.brandId] || 0) + weight;
      }

      if (!categoryScores[product.categoryId] && product.categoryId) {
        categoryScores[product.categoryId] = weight;
      }

      if (["PURCHASE", "ADD_TO_CART", "FAVORITE"].includes(row.behaviorType)) {
        const { unitPrice } = pricing.resolveUnitPrice(product, null);
        if (unitPrice > 0) {
          intentPrices.push(unitPrice);
        }
      }
    });

    const topOf = (scores) =>
      Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N)
        .map(([id, score]) => ({ id, score: Math.round(score * 100) / 100 }));

    const profile = {
      preferredCategories: topOf(categoryScores),
      preferredBrands: topOf(brandScores),
      preferredTags: [],
      preferredSpecs: {},
      minPrice: intentPrices.length ? pricing.roundMoney(Math.min(...intentPrices)) : null,
      maxPrice: intentPrices.length ? pricing.roundMoney(Math.max(...intentPrices)) : null,
      averagePrice: intentPrices.length
        ? pricing.roundMoney(intentPrices.reduce((sum, p) => sum + p, 0) / intentPrices.length)
        : null,
      lastCalculatedAt: new Date(),
    };

    await behaviorRepository.upsertProfile(userId, profile);

    return profile;
  }

  async getMyProfile(userId, { recompute = false } = {}) {
    if (recompute) {
      return this.recomputeProfile(userId);
    }

    const existing = await behaviorRepository.findProfileByUser(userId);

    // No profile yet means no tracked activity yet — build it now rather than
    // handing the caller a null it has to special-case.
    return existing ? existing.get({ plain: true }) : this.recomputeProfile(userId);
  }
}

module.exports = new BehaviorService();
