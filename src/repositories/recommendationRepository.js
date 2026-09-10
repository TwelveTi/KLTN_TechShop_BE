const { Op, fn, col } = require("sequelize");
const db = require("../models");

// Data-access for the recommender: the candidate catalogue, the signals it
// scores against, the precomputed similarity matrix, and the results it stores.
class RecommendationRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // Every active product with the facts content-based scoring needs. Loaded once
  // per request and scored in memory: the catalogue of a shop this size is small,
  // and one query beats N similarity lookups.
  findScorableProducts({ limit = 2000 } = {}) {
    return db.Product.findAll({
      where: { status: "ACTIVE" },
      attributes: [
        "id",
        "name",
        "slug",
        "categoryId",
        "brandId",
        "basePrice",
        "salePrice",
        "stockQuantity",
        "soldCount",
        "viewCount",
        "averageRating",
        "reviewCount",
        "isFeatured",
      ],
      limit,
      raw: true,
    });
  }

  findProductById(productId) {
    return db.Product.findByPk(productId, { raw: true });
  }

  /**
   * The presentation fields for the handful of products a rail actually returns.
   *
   * Deliberately NOT folded into `findScorableProducts`: that one is the hot
   * path and loads the whole catalogue, so it stays join-free. This runs on at
   * most `limit` ids by primary key, and it is the only place images, brand and
   * category names are read — a rail with no picture and no brand is not a rail,
   * it is a list of names.
   */
  async findProductCards(productIds) {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await db.Product.findAll({
      where: { id: productIds },
      attributes: [
        "id",
        "name",
        "slug",
        "shortDescription",
        "basePrice",
        "salePrice",
        "status",
        "stockQuantity",
        "averageRating",
        "reviewCount",
        "isFeatured",
      ],
      include: [
        { model: db.Category, as: "category", attributes: ["id", "name", "slug"] },
        { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
        {
          model: db.ProductImage,
          as: "images",
          attributes: ["imageUrl", "isPrimary", "sortOrder"],
          // `separate` keeps the primary-image ordering intact; a joined hasMany
          // would multiply the product rows and lose the ORDER BY.
          separate: true,
          order: [
            ["isPrimary", "DESC"],
            ["sortOrder", "ASC"],
          ],
        },
      ],
    });

    return new Map(rows.map((row) => [row.id, row]));
  }

  // tagIds and specs, shaped for utils/similarity. Returned as plain maps so the
  // scorer never has to touch the ORM.
  async findProductFacets(productIds) {
    if (productIds.length === 0) {
      return { tagsByProduct: {}, specsByProduct: {} };
    }

    const [tagRows, specRows] = await Promise.all([
      db.ProductTag.findAll({
        where: { productId: productIds },
        attributes: ["productId", "tagId"],
        raw: true,
      }),
      db.ProductSpecification.findAll({
        where: { productId: productIds },
        attributes: ["productId", "specificationDefinitionId", "valueText", "valueNumber"],
        include: [
          {
            model: db.SpecificationDefinition,
            as: "definition",
            attributes: ["key", "isComparable"],
            required: true,
            where: { isComparable: true },
          },
        ],
      }),
    ]);

    const tagsByProduct = {};
    tagRows.forEach((row) => {
      (tagsByProduct[row.productId] = tagsByProduct[row.productId] || []).push(row.tagId);
    });

    const specsByProduct = {};
    specRows.forEach((row) => {
      const bucket = (specsByProduct[row.productId] = specsByProduct[row.productId] || {});
      // valueNumber when the definition is typed, otherwise the text. Comparing
      // numbers as numbers is why 5.3.1 had to be fixed first.
      bucket[row.definition.key] = row.valueNumber !== null ? Number(row.valueNumber) : row.valueText;
    });

    return { tagsByProduct, specsByProduct };
  }

  // ── Signals ───────────────────────────────────────────────────────────────

  findProfile(userId) {
    return db.UserPreferenceProfile.findOne({ where: { userId }, raw: true });
  }

  // The products a shopper has actually interacted with, newest first, so the
  // recommender can lean on recency.
  /**
   * `before` chặn trên theo thời gian, cho phép dựng lại tín hiệu **như nó đã là**
   * tại một thời điểm trong quá khứ (`measure.js --loo`). Thiếu nó thì phép đo
   * tách theo thời gian vô nghĩa: mô hình sẽ đọc cả những hành vi xảy ra sau mốc
   * cắt, tức là nhìn thấy đúng thứ nó đang được yêu cầu dự đoán.
   */
  findRecentBehaviors(userId, { since, before = null, limit = 300 }) {
    const occurredAt = {
      ...(since ? { [Op.gte]: since } : {}),
      ...(before ? { [Op.lt]: before } : {}),
    };

    return db.UserBehavior.findAll({
      where: {
        userId,
        productId: { [Op.ne]: null },
        ...(Object.getOwnPropertySymbols(occurredAt).length > 0 ? { occurredAt } : {}),
      },
      attributes: ["behaviorType", "productId", "occurredAt"],
      order: [["occurredAt", "DESC"]],
      limit,
      raw: true,
    });
  }

  findRecentKeywords(userId, { before = null, limit = 20 } = {}) {
    return db.SearchHistory.findAll({
      where: {
        userId,
        ...(before ? { searchedAt: { [Op.lt]: before } } : {}),
      },
      attributes: ["keyword", "searchedAt"],
      order: [["searchedAt", "DESC"]],
      limit,
      raw: true,
    });
  }

  /**
   * Chỉ tập id sản phẩm đã mua — không kèm loại hành vi, không kèm thời điểm.
   *
   * `findRecentBehaviors` cũng trả về những dòng này, nhưng nó kéo tối đa 300
   * hành vi mọi loại rồi để service lọc. Đường đọc cache chỉ cần biết "đã mua
   * những gì", và dùng hàm kia ở đó sẽ trả lại phần lớn công việc mà cache vừa
   * tiết kiệm được.
   */
  async findPurchasedProductIds(userId, { since, behaviorTypes = ["PURCHASE"], limit = 300 } = {}) {
    const rows = await db.UserBehavior.findAll({
      where: {
        userId,
        behaviorType: behaviorTypes,
        productId: { [Op.ne]: null },
        ...(since ? { occurredAt: { [Op.gte]: since } } : {}),
      },
      attributes: ["productId"],
      // Trùng lặp bỏ ở JS, KHÔNG bằng `group: ["productId"]`. Sequelize 6 map tên
      // thuộc tính sang tên cột cho `attributes` và `where` nhưng **không** cho
      // `group` (`Utils.mapOptionFieldNames`), nên `group: ["productId"]` sinh ra
      // `GROUP BY productId` trong khi cột thật là `product_id` — truy vấn ném lỗi
      // mọi lần. Đó cũng là lý do `getOutcomeStats` phải viết `col("clicked_at")`
      // bằng tay. Tập id thì nhỏ, gộp trong bộ nhớ không mất gì.
      order: [["occurredAt", "DESC"]],
      limit,
      raw: true,
    });

    return [...new Set(rows.map((row) => row.productId))];
  }

  // ── Similarity matrix ─────────────────────────────────────────────────────

  findSimilarTo(productId, { limit = 12, minScore = 0 } = {}) {
    return db.ProductSimilarity.findAll({
      where: { productId, score: { [Op.gt]: minScore } },
      order: [["score", "DESC"]],
      limit,
      raw: true,
    });
  }

  /**
   * Láng giềng của nhiều sản phẩm nguồn cùng lúc, **top-N cho TỪNG nguồn**.
   *
   * Bản trước dùng `limit: productIds.length * limitPerProduct` cộng
   * `ORDER BY score DESC`, tức một **hạn mức chung** chứ không phải top-N mỗi
   * nguồn — và comment thì khai "the service keeps the top N per source", điều mà
   * service cũng không làm. Chưa gây hại vì `rebuildSimilarityMatrix` lưu đúng 12
   * láng giềng mỗi sản phẩm nên tổng không bao giờ vượt hạn mức. Nhưng chạy
   * `rebuild` với `perProduct` lớn hơn thì một sản phẩm vừa xem có điểm cao sẽ ăn
   * hết hạn mức và những sản phẩm còn lại mất tiếng — âm thầm, không lỗi, và
   * `scoreProductSimilarity` sẽ hỏng đúng ở chỗ khó thấy nhất.
   *
   * Cắt trong bộ nhớ thay vì trong SQL: một truy vấn window function cho MySQL 8
   * đắt hơn hẳn việc nhóm vài trăm dòng ở đây, và `LIMIT` thì không diễn tả được
   * "N mỗi nhóm".
   */
  async findSimilarToMany(productIds, { limitPerProduct = 12 } = {}) {
    if (productIds.length === 0) {
      return [];
    }

    const rows = await db.ProductSimilarity.findAll({
      where: { productId: productIds },
      attributes: ["productId", "similarProductId", "score", "similarityType"],
      order: [
        ["productId", "ASC"],
        ["score", "DESC"],
      ],
      raw: true,
    });

    const kept = [];
    const perSource = new Map();

    // Đã sắp theo (productId, score DESC) nên chỉ cần đếm là đủ, không cần sắp lại.
    rows.forEach((row) => {
      const taken = perSource.get(row.productId) || 0;
      if (taken >= limitPerProduct) {
        return;
      }
      perSource.set(row.productId, taken + 1);
      kept.push(row);
    });

    return kept;
  }

  async replaceSimilarities(rows, { similarityType }) {
    const transaction = await db.sequelize.transaction();

    try {
      // Rebuilt wholesale rather than patched: a stale pair that no longer
      // qualifies would otherwise linger forever.
      await db.ProductSimilarity.destroy({ where: { similarityType }, transaction });

      for (let i = 0; i < rows.length; i += 500) {
        await db.ProductSimilarity.bulkCreate(rows.slice(i, i + 500), { transaction });
      }

      await transaction.commit();
      return rows.length;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────

  /**
   * Dòng kết quả gần nhất còn trong hạn `expiresAt`, kèm items đã xếp thứ hạng.
   *
   * Không có danh tính thì KHÔNG có cache, và nhánh chặn dưới đây là bắt buộc:
   * gọi hàm này với cả `userId` lẫn `sessionId` rỗng sẽ dựng điều kiện
   * `sessionId IS NULL`, và điều kiện đó khớp đúng những dòng của người ĐÃ đăng
   * nhập (họ không có `sessionId`) — tức là trả gợi ý của người khác cho một
   * khách vô danh. `userId: null` ở nhánh khách vãng lai chặn cùng một lỗi theo
   * chiều ngược lại.
   */
  findFreshResult({ userId, sessionId, recommendationType }) {
    if (!userId && !sessionId) {
      return Promise.resolve(null);
    }

    return db.RecommendationResult.findOne({
      where: {
        recommendationType,
        expiresAt: { [Op.gt]: new Date() },
        ...(userId ? { userId } : { sessionId, userId: null }),
      },
      include: [
        {
          model: db.RecommendationItem,
          as: "items",
          separate: true,
          order: [["rankPosition", "ASC"]],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async createResultWithItems(result, items) {
    const transaction = await db.sequelize.transaction();

    try {
      const created = await db.RecommendationResult.create(result, { transaction });

      // The created rows are returned, not discarded: the caller needs each
      // item's id so the rail can report a click back against it. The ids exist
      // client-side already — the PK is a UUIDv4 generated by Sequelize, not by
      // MySQL — so this costs nothing extra.
      const createdItems = await db.RecommendationItem.bulkCreate(
        items.map((item) => ({ ...item, recommendationId: created.id })),
        { transaction },
      );

      await transaction.commit();

      return { result: created, items: createdItems };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  findItemById(itemId) {
    return db.RecommendationItem.findByPk(itemId, {
      include: [{ model: db.RecommendationResult, as: "recommendation", required: false }],
    });
  }

  updateItem(item, changes) {
    return item.update(changes);
  }

  /**
   * Outcome counters for the evaluation chapter: how many recommendations were
   * clicked, carted, bought — **tách theo `recommendationType`**.
   *
   * Bản trước `COUNT` mọi dòng `recommendation_items` không lọc gì cả, nên nó trộn
   * `PERSONALIZED_HOME` với `SIMILAR_PRODUCTS` thành **một** tỉ lệ. Hai dải đó có
   * bản chất khác nhau (một cái cá nhân hoá, một cái là láng giềng của sản phẩm
   * đang xem) và số lượt hiện rất khác nhau, nên tỉ lệ gộp không nói về cái nào
   * cả — trong khi đó chính là con số chương Đánh giá trích ra.
   *
   * `since` cũng đã được nối vào tận controller: trước đây nó tồn tại ở đây nhưng
   * người gọi không truyền bao giờ, tức là code chết.
   *
   * Viết SQL thẳng thay vì `group` của Sequelize: Sequelize 6 map tên thuộc tính
   * sang tên cột cho `attributes`/`where` nhưng **không** cho `group`
   * (`Utils.mapOptionFieldNames`), nên `group: ["recommendation.recommendationType"]`
   * sinh ra SQL sai. Cùng lý do với `col("clicked_at")` viết tay ở bản cũ.
   */
  async getOutcomeStats({ since = null } = {}) {
    const rows = await db.sequelize.query(
      `SELECT r.recommendation_type                AS recommendationType,
              COUNT(i.id)                          AS shown,
              COUNT(i.clicked_at)                  AS clicked,
              COUNT(i.added_to_cart_at)            AS addedToCart,
              COUNT(i.purchased_at)                AS purchased
         FROM recommendation_items i
         JOIN recommendation_results r ON r.id = i.recommendation_id
        ${since ? "WHERE i.created_at >= :since" : ""}
        GROUP BY r.recommendation_type
        ORDER BY shown DESC`,
      {
        replacements: since ? { since } : {},
        type: db.sequelize.QueryTypes.SELECT,
      },
    );

    return rows;
  }
}

module.exports = new RecommendationRepository();
