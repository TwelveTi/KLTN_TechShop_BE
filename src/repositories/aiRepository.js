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
const shapeProduct = (product, specs) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  shortDescription: product.shortDescription,
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
