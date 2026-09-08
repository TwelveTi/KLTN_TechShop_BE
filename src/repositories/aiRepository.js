const { Op, fn, col, where: sqlWhere } = require("sequelize");
const db = require("../models");

// Data-access for the AI advisor.
//
// Every product fact the assistant is allowed to state comes from this file.
// The service never lets the model name a product, quote a price or invent a
// specification: it hands the model rows this repository returned and asks it
// to explain them (BE README 7.0.1). That rule is only enforceable if there is
// exactly one place product facts can enter the conversation, and this is it.
class AiRepository {
  // ── Vocabulary ────────────────────────────────────────────────────────────

  /**
   * What the model is allowed to filter on: leaf categories, their comparable
   * specifications, and the brands actually carried.
   *
   * Without this the model invents filter keys. It will ask for `ram_gb` or
   * `screen_size` because those are plausible names, and every one of them
   * matches nothing. Handing it the real keys with their unit and dataType
   * turns a guess into a lookup.
   *
   * Only `isComparable` definitions are exposed — that flag exists precisely to
   * mark the specs that mean something when compared across products.
   */
  async findFilterVocabulary() {
    const [categories, brands, counts] = await Promise.all([
      db.Category.findAll({
        where: { isActive: true },
        attributes: ["id", "name", "slug", "parentId"],
        include: [
          {
            model: db.SpecificationDefinition,
            as: "specificationDefinitions",
            attributes: ["key", "name", "dataType", "unit", "sortOrder"],
            where: { isComparable: true },
            required: false,
          },
        ],
        order: [
          ["sortOrder", "ASC"],
          ["name", "ASC"],
        ],
      }),
      db.Brand.findAll({ attributes: ["id", "name", "slug"], raw: true }),
      db.Product.findAll({
        where: { status: "ACTIVE" },
        attributes: ["categoryId", [fn("COUNT", col("id")), "total"]],
        group: ["categoryId"],
        raw: true,
      }),
    ]);

    const directCount = new Map(counts.map((row) => [row.categoryId, Number(row.total)]));

    // A parent's reach includes its children, because `searchProducts` widens a
    // parent slug to its subtree.
    const reachableCount = (category) =>
      (directCount.get(category.id) || 0) +
      categories
        .filter((other) => other.parentId === category.id)
        .reduce((sum, child) => sum + (directCount.get(child.id) || 0), 0);

    return {
      // Empty categories are withheld on purpose. Offering the model a slug it
      // can never match is not a neutral omission — it actively misleads: asked
      // for a programming laptop it will reach for `laptop-van-phong` because
      // the name fits, get nothing back, and spend the remaining tool turns
      // guessing at neighbours. Every filter value handed over must be one that
      // can return a row.
      categories: categories
        .filter((category) => reachableCount(category) > 0)
        .map((category) => ({
          slug: category.slug,
          name: category.name,
          productCount: reachableCount(category),
          // The parent link is what lets the prompt render a tree instead of a
          // flat list. Without it the model cannot tell that searching
          // `laptop-may-tinh` already covered `laptop-gaming`, so it searches
          // both and burns a tool turn re-finding what it had.
          parentSlug: categories.find((other) => other.id === category.parentId)?.slug || null,
          isLeaf: categories.every((other) => other.parentId !== category.id),
          specs: (category.specificationDefinitions || [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((definition) => ({
              key: definition.key,
              name: definition.name,
              dataType: definition.dataType,
              unit: definition.unit,
            })),
        })),
      brands: brands.map((brand) => ({ slug: brand.slug, name: brand.name })),
    };
  }

  // ── Grounding query ───────────────────────────────────────────────────────

  /**
   * The only way products reach the model.
   *
   * Scalar constraints (category, brand, price, stock) run in SQL. Numeric and
   * text spec constraints are applied in memory afterwards, because a spec
   * filter is a row in `product_specifications` and an AND across three specs
   * would need three self-joins to express. The catalogue of a shop this size
   * is small enough that filtering the candidates in memory is cheaper than the
   * query it replaces — the same trade-off `recommendationRepository` already
   * makes, for the same reason.
   *
   * `specFilters` only ever touch `value_number` (numeric ops) or `value_text`
   * (`contains`). A NUMBER definition whose row has a NULL `value_number` is
   * treated as not matching rather than as a text fallback: falling back would
   * silently compare "16GB" as a string and hand the shopper a wrong answer,
   * which is the bug 5.3.1 was fixed to remove.
   */
  async searchProducts({
    categorySlug = null,
    brandNames = [],
    minPrice = null,
    maxPrice = null,
    specFilters = [],
    inStockOnly = false,
    sortBy = "relevance",
    limit = 8,
  } = {}) {
    const where = { status: "ACTIVE" };

    if (inStockOnly) {
      where.stockQuantity = { [Op.gt]: 0 };
    }

    // Price ranges are quoted against what the shopper would actually pay, so
    // a product on sale must be judged by its sale price, not its list price.
    const effectivePrice = fn("COALESCE", col("Product.sale_price"), col("Product.base_price"));
    const priceBounds = [];
    if (minPrice !== null) {
      priceBounds.push(sqlWhere(effectivePrice, { [Op.gte]: minPrice }));
    }
    if (maxPrice !== null) {
      priceBounds.push(sqlWhere(effectivePrice, { [Op.lte]: maxPrice }));
    }
    if (priceBounds.length > 0) {
      where[Op.and] = priceBounds;
    }

    const categoryIds = categorySlug ? await this.resolveCategoryIds(categorySlug) : null;
    if (categoryIds) {
      // An empty array here means the model named a category that does not
      // exist. Returning no rows is correct: inventing a fallback category
      // would answer a question the shopper never asked.
      where.categoryId = categoryIds;
    }

    const include = [
      { model: db.Category, as: "category", attributes: ["id", "name", "slug"] },
      {
        model: db.Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
        ...(brandNames.length > 0
          ? { required: true, where: { name: { [Op.in]: brandNames } } }
          : {}),
      },
      {
        model: db.ProductImage,
        as: "images",
        attributes: ["imageUrl", "isPrimary", "sortOrder"],
        separate: true,
        order: [
          ["isPrimary", "DESC"],
          ["sortOrder", "ASC"],
        ],
        limit: 1,
      },
    ];

    const candidates = await db.Product.findAll({
      where,
      include,
      attributes: [
        "id",
        "name",
        "slug",
        "shortDescription",
        "basePrice",
        "salePrice",
        "stockQuantity",
        "soldCount",
        "averageRating",
        "reviewCount",
      ],
      // Generous cap: this is the pool the spec filters then narrow, not the
      // answer. Cutting it to `limit` here would drop products that match the
      // specs in favour of ones that merely sort well.
      limit: 200,
    });

    const specsByProduct = await this.findComparableSpecs(candidates.map((row) => row.id));
    const matched = candidates.filter((product) =>
      matchesSpecFilters(specsByProduct[product.id] || {}, specFilters),
    );

    return sortProducts(matched, sortBy)
      .slice(0, limit)
      .map((product) => shapeProduct(product, specsByProduct[product.id] || {}));
  }

  /**
   * Tra sản phẩm theo TÊN người dùng gõ, cho tính năng so sánh.
   *
   * Không dùng `LIKE '%tên%'`: khách gõ "macbook air m2" còn trong kho là
   * "Apple MacBook Air 13.6 inch M2 (8GB / 256GB SSD)" — không chuỗi con nào
   * khớp. Nên chấm điểm theo TỪ: tên nào phủ được nhiều từ khoá nhất thì thắng.
   *
   * Nạp cả catalogue rồi lọc trong bộ nhớ. Với vài chục sản phẩm thì một truy
   * vấn rẻ hơn hẳn việc dựng một câu SQL mờ, và độ chính xác cao hơn nhiều — đây
   * cũng là đánh đổi `searchProducts` đã chọn, cùng lý do.
   */
  async findProductsByNames(names, { limit = 4 } = {}) {
    if (!Array.isArray(names) || names.length === 0) {
      return [];
    }

    const rows = await db.Product.findAll({
      where: { status: "ACTIVE" },
      attributes: [
        "id",
        "name",
        "slug",
        "shortDescription",
        // Mô tả dài CHỈ nạp ở đường tra theo tên, không ở `searchProducts`.
        // Đây là nguyên liệu để nói ưu/nhược điểm, mà so sánh thì tối đa 4 sản
        // phẩm; `searchProducts` trả về hàng chục nên đưa vào đó là nhân số
        // token lên nhiều lần cho một thứ không ai đọc.
        "description",
        "basePrice",
        "salePrice",
        "stockQuantity",
        "soldCount",
        "averageRating",
        "reviewCount",
      ],
      include: [
        { model: db.Category, as: "category", attributes: ["id", "name", "slug"] },
        { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
        {
          model: db.ProductImage,
          as: "images",
          attributes: ["imageUrl", "isPrimary", "sortOrder"],
          separate: true,
          order: [
            ["isPrimary", "DESC"],
            ["sortOrder", "ASC"],
          ],
          limit: 1,
        },
      ],
    });

    const picked = [];
    const used = new Set();

    for (const raw of names.slice(0, limit)) {
      const tokens = tokenize(raw);
      if (tokens.length === 0) continue;

      let best = null;
      let bestScore = 0;

      for (const product of rows) {
        // Mỗi sản phẩm chỉ khớp một tên: không có dòng này thì "iPhone 15" và
        // "iPhone 15 Pro Max" cùng trỏ về một sản phẩm và bảng so sánh có hai
        // cột giống hệt nhau.
        if (used.has(product.id)) continue;

        const haystack = tokenize(`${product.name} ${product.brand?.name || ""}`);
        const hits = tokens.filter((token) => haystack.some((word) => word.includes(token))).length;
        const score = hits / tokens.length;

        if (score > bestScore) {
          bestScore = score;
          best = product;
        }
      }

      // Ngưỡng một nửa số từ. Thấp hơn thì "so sánh cái nào tốt" cũng khớp bừa
      // một sản phẩm nào đó và model sẽ so sánh thứ khách không hề nhắc tới.
      if (best && bestScore >= 0.5) {
        used.add(best.id);
        picked.push(best);
      }
    }

    const pickedIds = picked.map((row) => row.id);
    const [specsByProduct, reviewsByProduct] = await Promise.all([
      this.findComparableSpecs(pickedIds),
      this.findRepresentativeReviews(pickedIds),
    ]);

    return picked.map((product) =>
      shapeProduct(product, specsByProduct[product.id] || {}, {
        description: product.description,
        reviews: reviewsByProduct[product.id] || [],
      }),
    );
  }

  /**
   * Vài đánh giá tiêu biểu của mỗi sản phẩm — nguyên liệu để nói ƯU/NHƯỢC ĐIỂM.
   *
   * Bảng thông số nói được máy nào nhiều RAM hơn, nhưng không nói được máy nào
   * nóng, máy nào loa bé, máy nào pin tụt nhanh sau vài tháng. Thứ đó nằm trong
   * lời khách đã mua, và trước thay đổi này nó chưa bao giờ tới được model —
   * nên khi bị bảo "nêu ưu nhược điểm", model chỉ có hai đường: đọc lại chính
   * con số vừa nêu, hoặc lấy từ kiến thức nội tại của nó. Cả hai đều là thứ
   * mục 7.0.1 tồn tại để chặn.
   *
   * **Lấy cả hai phía, không lấy ngẫu nhiên.** Đánh giá cao nhất và thấp nhất,
   * chứ không phải mới nhất: một sản phẩm 5 review 5 sao thì "mới nhất" cho ra
   * năm lời khen và model sẽ không có gì để viết vào phần nhược điểm.
   */
  async findRepresentativeReviews(productIds, { perProduct = 3 } = {}) {
    if (productIds.length === 0) {
      return {};
    }

    const rows = await db.Review.findAll({
      where: {
        productId: productIds,
        status: "APPROVED",
        content: { [Op.ne]: null },
      },
      attributes: ["productId", "rating", "title", "content"],
      order: [["rating", "DESC"]],
      raw: true,
    });

    const byProduct = {};

    for (const row of rows) {
      const content = (row.content || "").trim();
      if (content === "") continue;
      (byProduct[row.productId] = byProduct[row.productId] || []).push({
        rating: row.rating,
        title: row.title || null,
        // Cắt ngắn: một review dài không mang thêm tín hiệu nào so với vài câu
        // đầu, và bốn sản phẩm nhân ba review nhân độ dài đầy đủ là một phần
        // đáng kể của ngân sách context.
        content: content.length > 240 ? `${content.slice(0, 240)}…` : content,
      });
    }

    // Đã sắp theo rating giảm dần, nên lấy từ hai đầu là được khen nhất và chê
    // nhất. Với `perProduct = 3`: hai đầu trên, một đầu dưới.
    for (const [productId, list] of Object.entries(byProduct)) {
      if (list.length <= perProduct) continue;

      const takeTop = perProduct - 1;
      byProduct[productId] = [...list.slice(0, takeTop), list[list.length - 1]];
    }

    return byProduct;
  }

  /** A parent category stands for its children — "laptop" must not exclude "gaming laptop". */
  async resolveCategoryIds(slugOrName) {
    const category = await db.Category.findOne({
      where: { [Op.or]: [{ slug: slugOrName }, { name: slugOrName }] },
      attributes: ["id"],
      raw: true,
    });

    if (!category) {
      return [];
    }

    const children = await db.Category.findAll({
      where: { parentId: category.id },
      attributes: ["id"],
      raw: true,
    });

    return [category.id, ...children.map((child) => child.id)];
  }

  /**
   * Comparable specs keyed by product, then by definition key.
   *
   * Both the typed value and the display text are kept. The filters compare the
   * typed one; the model is shown the text, so it repeats "16GB DDR5" the way
   * the product page words it instead of rendering a bare 16.
   */
  async findComparableSpecs(productIds) {
    if (productIds.length === 0) {
      return {};
    }

    const rows = await db.ProductSpecification.findAll({
      where: { productId: productIds },
      attributes: ["productId", "valueText", "valueNumber", "valueBoolean"],
      include: [
        {
          model: db.SpecificationDefinition,
          as: "definition",
          attributes: ["key", "name", "dataType", "unit"],
          where: { isComparable: true },
          required: true,
        },
      ],
    });

    const byProduct = {};
    rows.forEach((row) => {
      const bucket = (byProduct[row.productId] = byProduct[row.productId] || {});
      bucket[row.definition.key] = {
        name: row.definition.name,
        unit: row.definition.unit,
        dataType: row.definition.dataType,
        text: row.valueText,
        number: row.valueNumber === null ? null : Number(row.valueNumber),
        boolean: row.valueBoolean,
      };
    });

    return byProduct;
  }

  // ── Conversation state ────────────────────────────────────────────────────

  findConversation(conversationId) {
    return db.AiConversation.findByPk(conversationId, { raw: true });
  }

  createConversation({ userId, sessionId, conversationType, title }) {
    return db.AiConversation.create({ userId, sessionId, conversationType, title });
  }

  /**
   * The most recent turns, returned oldest first.
   *
   * The two orderings are the whole point. `LIMIT` has to run against `DESC` to
   * take the NEWEST rows — pairing it with `ASC` silently keeps the first 20
   * messages of the thread and drops everything the shopper just said, which is
   * the exact opposite of context. The reverse afterwards restores chronology,
   * because the model reads a conversation forwards.
   *
   * TOOL rows are excluded: that traffic is persisted for the evaluation
   * chapter, not to be replayed. Feeding a stale product list back as context
   * would let the model answer a new question from an old query's rows, which is
   * grounding in name only.
   */
  async findMessages(conversationId, { limit = 20 } = {}) {
    const rows = await db.AiMessage.findAll({
      where: { conversationId, role: { [Op.in]: ["USER", "ASSISTANT"] } },
      attributes: ["role", "content", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit,
      raw: true,
    });

    return rows.reverse();
  }

  createMessage(payload) {
    return db.AiMessage.create(payload);
  }

  /**
   * Danh sách hội thoại của một người, mới nhất trước.
   *
   * Chủ sở hữu được xác định giống hệt `resolveConversation` trong service:
   * người đã đăng nhập theo `userId`, khách vãng lai theo `sessionId`. Truyền
   * cả hai vào một câu `OR` sẽ để lộ hội thoại của người khác trên cùng một
   * máy, nên hai trường hợp là hai nhánh tách bạch.
   */
  findConversations({ userId, sessionId, limit = 50 }) {
    const where = userId
      ? { userId, status: "ACTIVE" }
      : { userId: null, sessionId, status: "ACTIVE" };

    return db.AiConversation.findAll({
      where,
      attributes: ["id", "title", "conversationType", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit,
      raw: true,
    });
  }

  /**
   * Lượt hỏi đáp của một hội thoại, kèm sản phẩm đã gợi ý ở từng lượt.
   *
   * `ai_recommended_products` được đọc riêng thay vì join: một tin nhắn có tối
   * đa chục sản phẩm, và join vào sẽ nhân dòng tin nhắn lên rồi phải gộp lại
   * bằng tay. Hai truy vấn nhỏ dễ đọc hơn một truy vấn phải sửa sau.
   */
  async findConversationMessages(conversationId) {
    const messages = await db.AiMessage.findAll({
      where: { conversationId, role: { [Op.in]: ["USER", "ASSISTANT"] } },
      attributes: ["id", "role", "content", "structuredData", "createdAt"],
      order: [["createdAt", "ASC"]],
      raw: true,
    });

    const assistantIds = messages.filter((row) => row.role === "ASSISTANT").map((row) => row.id);

    if (assistantIds.length === 0) {
      return { messages, productsByMessage: {} };
    }

    const links = await db.AiRecommendedProduct.findAll({
      where: { messageId: assistantIds },
      attributes: ["messageId", "productId", "rankPosition"],
      order: [["rankPosition", "ASC"]],
      raw: true,
    });

    const cards = await this.findProductCardsByIds([...new Set(links.map((row) => row.productId))]);

    const productsByMessage = {};
    links.forEach((link) => {
      const card = cards[link.productId];
      // Sản phẩm đã bị xoá khỏi catalogue thì bỏ qua: hiện lại một thẻ trỏ vào
      // hư không còn tệ hơn là một câu trả lời cũ thiếu mất thẻ.
      if (card) {
        (productsByMessage[link.messageId] = productsByMessage[link.messageId] || []).push(card);
      }
    });

    return { messages, productsByMessage };
  }

  /** Thẻ sản phẩm cho lịch sử hội thoại, khoá theo id. */
  async findProductCardsByIds(productIds) {
    if (productIds.length === 0) {
      return {};
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
        "stockQuantity",
        "soldCount",
        "averageRating",
        "reviewCount",
      ],
      include: [
        { model: db.Category, as: "category", attributes: ["id", "name", "slug"] },
        { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
        {
          model: db.ProductImage,
          as: "images",
          attributes: ["imageUrl", "isPrimary", "sortOrder"],
          separate: true,
          order: [
            ["isPrimary", "DESC"],
            ["sortOrder", "ASC"],
          ],
          limit: 1,
        },
      ],
    });

    const specsByProduct = await this.findComparableSpecs(rows.map((row) => row.id));

    return rows.reduce((acc, product) => {
      acc[product.id] = shapeProduct(product, specsByProduct[product.id] || {});
      return acc;
    }, {});
  }

  /**
   * Đóng một hội thoại.
   *
   * Đặt `status = CLOSED` chứ không xoá hẳn: `ai_messages` và
   * `ai_recommended_products` là dữ liệu của chương Đánh giá — bao nhiêu lượt
   * hỏi, AI đã truy vấn gì, gợi ý sản phẩm nào. Cho người dùng xoá thật là tự
   * tay bốc hơi mẫu đo giữa lúc đang làm luận văn.
   */
  async closeConversation(conversationId) {
    const [affected] = await db.AiConversation.update(
      { status: "CLOSED" },
      { where: { id: conversationId } },
    );

    return affected > 0;
  }

  /** The audit trail: which products a given answer was actually built from. */
  linkRecommendedProducts(messageId, products) {
    if (products.length === 0) {
      return Promise.resolve([]);
    }

    return db.AiRecommendedProduct.bulkCreate(
      products.map((product, index) => ({
        messageId,
        productId: product.id,
        rankPosition: index + 1,
        reason: product.matchReason || null,
      })),
      { ignoreDuplicates: true },
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Chuỗi → danh sách từ để so khớp tên sản phẩm.
 *
 * Bỏ dấu tiếng Việt vì khách gõ "dien thoai" cũng phải khớp "Điện Thoại", và bỏ
 * mọi ký tự không phải chữ/số để "M3 Pro" khớp được với "(M3 Pro)". Từ một ký tự
 * bị loại: chúng khớp với gần như mọi thứ và chỉ làm loãng điểm.
 */
const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

const matchesSpecFilters = (specs, filters) =>
  filters.every((filter) => {
    const spec = specs[filter.key];
    if (!spec) {
      return false;
    }

    if (filter.op === "contains") {
      return String(spec.text || "")
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    }

    const target = Number(filter.value);
    if (spec.number === null || !Number.isFinite(target)) {
      return false;
    }

    switch (filter.op) {
      case "gte":
        return spec.number >= target;
      case "lte":
        return spec.number <= target;
      case "eq":
        return spec.number === target;
      default:
        return false;
    }
  });

const priceOf = (product) =>
  Number(product.salePrice === null ? product.basePrice : product.salePrice);

const sortProducts = (products, sortBy) => {
  const sorted = products.slice();

  switch (sortBy) {
    case "priceAsc":
      return sorted.sort((a, b) => priceOf(a) - priceOf(b));
    case "priceDesc":
      return sorted.sort((a, b) => priceOf(b) - priceOf(a));
    case "rating":
      return sorted.sort((a, b) => Number(b.averageRating) - Number(a.averageRating));
    case "bestSelling":
      return sorted.sort((a, b) => b.soldCount - a.soldCount);
    default:
      // "relevance" has no signal of its own inside a filtered set — everything
      // left already satisfies every constraint. Sales rank is the honest
      // tie-breaker, and it keeps the order stable between identical questions.
      return sorted.sort((a, b) => b.soldCount - a.soldCount);
  }
};

/** Flattens a product row plus its specs into what the model and the client both read. */
/**
 * @param {object} extras  Chỉ đường tra theo tên (so sánh) truyền vào — mô tả
 *   dài và đánh giá của khách. `searchProducts` để trống, và đó là chủ đích:
 *   nó trả về hàng chục sản phẩm, thêm hai trường đó vào là nhân token lên
 *   nhiều lần cho thứ không dùng tới ở đường tư vấn.
 */
const shapeProduct = (product, specs, extras = {}) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  shortDescription: product.shortDescription,
  description: extras.description ?? null,
  reviews: extras.reviews ?? [],
  price: priceOf(product),
  basePrice: Number(product.basePrice),
  salePrice: product.salePrice === null ? null : Number(product.salePrice),
  inStock: product.stockQuantity > 0,
  stockQuantity: product.stockQuantity,
  averageRating: Number(product.averageRating),
  reviewCount: product.reviewCount,
  category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
  brand: product.brand ? { name: product.brand.name, slug: product.brand.slug } : null,
  imageUrl: product.images?.[0]?.imageUrl || null,
  specs: Object.entries(specs).reduce((acc, [key, spec]) => {
    acc[key] = {
      label: spec.name,
      value: spec.text,
      number: spec.number,
      unit: spec.unit,
    };
    return acc;
  }, {}),
});

module.exports = new AiRepository();
