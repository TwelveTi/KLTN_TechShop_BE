const { Op, fn, col } = require("sequelize");
const db = require("../models");

// Data-access for the two tracking tables that feed the recommendation system:
// `user_behaviors` (what people did) and `search_histories` (what they typed).
//
// They are deliberately separate — see models.md 13.5. SearchHistory serves the
// "your recent searches" UI and keyword analysis; UserBehavior is the event log
// the recommender reads. A search writes to both.
class BehaviorRepository {
  createBehavior(data, { transaction } = {}) {
    return db.UserBehavior.create(data, { transaction });
  }

  bulkCreateBehaviors(rows, { transaction } = {}) {
    return db.UserBehavior.bulkCreate(rows, { transaction });
  }

  // Used to suppress duplicate views: reloading a product page ten times is one
  // interesting event, not ten. Scoped to whichever identity the visitor has.
  findRecentBehavior({ userId, sessionId, behaviorType, productId, since }) {
    const where = { behaviorType, occurredAt: { [Op.gte]: since } };

    if (productId) {
      where.productId = productId;
    }

    // An anonymous visitor is identified by sessionId only, a signed-in one by
    // userId only — never both, or a visitor who signs in mid-session would
    // match nothing and re-log every view.
    if (userId) {
      where.userId = userId;
    } else {
      where.sessionId = sessionId;
    }

    return db.UserBehavior.findOne({ where, order: [["occurredAt", "DESC"]] });
  }

  createSearchHistory(data, { transaction } = {}) {
    return db.SearchHistory.create(data, { transaction });
  }

  findSearchHistoryByUser(userId, { limit, offset }) {
    return db.SearchHistory.findAndCountAll({
      where: { userId },
      attributes: ["id", "keyword", "categoryId", "filters", "resultCount", "searchedAt"],
      order: [["searchedAt", "DESC"]],
      limit,
      offset,
    });
  }

  // The "recent searches" dropdown wants distinct keywords, not the same word
  // twenty times in a row.
  findDistinctKeywordsByUser(userId, limit) {
    return db.SearchHistory.findAll({
      attributes: ["keyword", [fn("MAX", col("searched_at")), "lastSearchedAt"]],
      where: { userId },
      group: ["keyword"],
      order: [[fn("MAX", col("searched_at")), "DESC"]],
      limit,
      raw: true,
    });
  }

  destroySearchHistoryByUser(userId) {
    return db.SearchHistory.destroy({ where: { userId } });
  }

  destroySearchHistoryById(id, userId) {
    return db.SearchHistory.destroy({ where: { id, userId } });
  }

  /**
   * `UPDATE products SET view_count = view_count + 1` — cộng trong SQL, không
   * đọc-rồi-ghi. Hai lượt xem cùng lúc trên cùng sản phẩm thì cách đọc-rồi-ghi
   * sẽ mất một lượt, còn đây thì không.
   *
   * Không nhận `transaction`: người gọi là `behaviorService.track`, vốn chạy
   * NGOÀI mọi transaction nghiệp vụ đúng theo thiết kế — đếm lượt xem hỏng không
   * được phép kéo theo thứ gì khác.
   */
  incrementProductViewCount(productId) {
    return db.Product.increment("viewCount", { by: 1, where: { id: productId } });
  }

  // ── Aggregates for the preference profile ─────────────────────────────────

  /**
   * Behaviour counts per category for one user, weighted later by the service.
   *
   * `before` dựng hồ sơ **như nó đã là** tại một thời điểm trong quá khứ, phục vụ
   * phép đo tách theo thời gian (`measure.js --loo`). Không có nó thì hồ sơ được
   * dựng từ cả những sự kiện nằm SAU mốc cắt, và phép đo sẽ chấm điểm cho một hệ
   * thống đã nhìn thấy đáp án.
   */
  countBehaviorsByCategory(userId, { since, before } = {}) {
    const where = { userId, categoryId: { [Op.ne]: null } };

    if (since || before) {
      where.occurredAt = {
        ...(since ? { [Op.gte]: since } : {}),
        ...(before ? { [Op.lt]: before } : {}),
      };
    }

    return db.UserBehavior.findAll({
      attributes: ["categoryId", "behaviorType", [fn("COUNT", col("id")), "total"]],
      where,
      group: ["categoryId", "behaviorType"],
      raw: true,
    });
  }

  // Brand and price signals have to come through the product, so this joins
  // rather than reading a column off the event.
  findBehaviorProductFacts(userId, { since, before } = {}) {
    const where = { userId, productId: { [Op.ne]: null } };

    if (since || before) {
      where.occurredAt = {
        ...(since ? { [Op.gte]: since } : {}),
        ...(before ? { [Op.lt]: before } : {}),
      };
    }

    return db.UserBehavior.findAll({
      attributes: ["behaviorType", "productId"],
      where,
      include: [
        {
          model: db.Product,
          as: "product",
          attributes: ["id", "brandId", "categoryId", "basePrice", "salePrice"],
          required: true,
        },
      ],
    });
  }

  findProfileByUser(userId, { transaction } = {}) {
    return db.UserPreferenceProfile.findOne({ where: { userId }, transaction });
  }

  upsertProfile(userId, data, { transaction } = {}) {
    return db.UserPreferenceProfile.upsert({ userId, ...data }, { transaction });
  }
}

module.exports = new BehaviorRepository();
