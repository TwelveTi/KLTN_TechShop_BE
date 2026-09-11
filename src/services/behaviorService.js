const AppError = require("../utils/AppError");
const behaviorRepository = require("../repositories/behaviorRepository");
const logger = require("../utils/logger");
const pricing = require("../utils/pricing");

const { BEHAVIOR_TYPES, effectiveWeight } = require("../utils/behaviorSignals");

// Trung bình có trọng số; rơi về trung bình thường nếu mọi trọng số bằng 0.
const weightedMean = (entries) => {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);

  return totalWeight > 0
    ? entries.reduce((sum, e) => sum + e.price * e.weight, 0) / totalWeight
    : entries.reduce((sum, e) => sum + e.price, 0) / entries.length;
};

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

      const behavior = await behaviorRepository.createBehavior({
        userId,
        sessionId,
        behaviorType,
        productId,
        categoryId,
        metadata,
        occurredAt: new Date(),
      });

      /**
       * `products.view_count` chỉ được tăng ở ĐÚNG chỗ này.
       *
       * Trước thay đổi này không nơi nào trong ứng dụng tăng nó — grep cả `src/`
       * chỉ ra seed và `scorePopularity`. Tức là `viewCount` là dữ liệu chết:
       * `scorePopularity` cấp cho nó 0.15 trọng số nhưng con số nó đọc mãi mãi là
       * con số viết tay trong `seed/data/products.data.js`, không bao giờ phản
       * ánh việc ai đã xem gì.
       *
       * Đặt sau bước khử trùng lặp là cố ý: F5 mười lần là một lượt xem đáng kể,
       * không phải mười. Nếu tăng trước bước đó thì `viewCount` sẽ đo số lần tải
       * trang chứ không đo sự chú ý, và nó sẽ lệch pha với chính `user_behaviors`
       * mà mọi thành phần còn lại đang đọc.
       *
       * Nằm trong `try` của `track` nên nó thừa hưởng đúng lời hứa của hàm này:
       * một lượt cộng thất bại được ghi log rồi bỏ qua, không bao giờ làm trắng
       * trang sản phẩm.
       */
      if (behaviorType === "VIEW_PRODUCT" && productId) {
        await behaviorRepository.incrementProductViewCount(productId);
      }

      return behavior;
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
  /**
   * @param {string} userId
   * @param {Object} [options]
   * @param {Date|null} [options.before]  dựng hồ sơ như nó đã là tại thời điểm
   *        này, bỏ mọi sự kiện từ đó trở đi. Cửa sổ 90 ngày trượt theo, nếu không
   *        thì một mốc cắt cũ sẽ đọc một cửa sổ dài hơn 90 ngày.
   * @param {boolean} [options.persist=true]  ghi xuống `user_preference_profiles`.
   *        Đặt `false` cho đường đo lường: một hồ sơ "tính tới ngày X" không phải
   *        hồ sơ hiện tại của khách, ghi đè lên là làm hỏng dữ liệu thật.
   */
  async recomputeProfile(userId, { before = null, persist = true } = {}) {
    const anchor = before ? before.getTime() : Date.now();
    const since = new Date(anchor - PROFILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [categoryRows, productFacts] = await Promise.all([
      behaviorRepository.countBehaviorsByCategory(userId, { since, before }),
      behaviorRepository.findBehaviorProductFacts(userId, { since, before }),
    ]);

    // Tuổi sự kiện tính từ chính mốc dựng hồ sơ, không phải từ `Date.now()` —
    // nếu không, hồ sơ "tính tới ngày X" sẽ suy giảm theo hôm nay.
    const daysAgoOf = (occurredAt) =>
      Math.max(0, Math.floor((anchor - new Date(occurredAt).getTime()) / (24 * 60 * 60 * 1000)));

    const categoryScores = {};
    categoryRows.forEach((row) => {
      const weight = effectiveWeight(row.behaviorType, Number(row.daysAgo) || 0);
      categoryScores[row.categoryId] = (categoryScores[row.categoryId] || 0) + Number(row.total) * weight;
    });

    const brandScores = {};
    // Prices are collected only from the signals that imply real intent —
    // a glance at a flagship should not stretch someone's budget upward.
    const intentPrices = [];

    productFacts.forEach((row) => {
      const product = row.product;
      const weight = effectiveWeight(row.behaviorType, daysAgoOf(row.occurredAt));

      if (product.brandId) {
        brandScores[product.brandId] = (brandScores[product.brandId] || 0) + weight;
      }

      if (!categoryScores[product.categoryId] && product.categoryId) {
        categoryScores[product.categoryId] = weight;
      }

      if (["PURCHASE", "ADD_TO_CART", "FAVORITE"].includes(row.behaviorType)) {
        const { unitPrice } = pricing.resolveUnitPrice(product, null);
        if (unitPrice > 0) {
          intentPrices.push({ price: unitPrice, weight });
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
      // Dải giá giữ nguyên là bao lồi của mọi tín hiệu có ý định — nó mô tả
      // khách đã từng cân nhắc tới đâu. Chỉ `averagePrice` (điểm giá đang nhắm)
      // mới suy giảm, nên ngân sách mới kéo được nó ra khỏi ngân sách cũ.
      minPrice: intentPrices.length ? pricing.roundMoney(Math.min(...intentPrices.map((p) => p.price))) : null,
      maxPrice: intentPrices.length ? pricing.roundMoney(Math.max(...intentPrices.map((p) => p.price))) : null,
      averagePrice: intentPrices.length ? pricing.roundMoney(weightedMean(intentPrices)) : null,
      lastCalculatedAt: new Date(),
    };

    if (persist) {
      await behaviorRepository.upsertProfile(userId, profile);
    }

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
