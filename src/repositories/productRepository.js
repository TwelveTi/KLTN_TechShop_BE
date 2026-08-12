const { Op } = require("sequelize");
const db = require("../models");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

// Full include set for a single product detail.
const PRODUCT_DETAIL_INCLUDE = () => [
  { model: db.Category, as: "category" },
  { model: db.Brand, as: "brand" },
  { model: db.ProductImage, as: "images" },
  { model: db.ProductVariant, as: "variants" },
  {
    model: db.ProductSpecification,
    as: "specifications",
    include: [{ model: db.SpecificationDefinition, as: "definition" }],
  },
  { model: db.Tag, as: "tags" },
];

// Data-access + query shaping for products (listing filters, detail, and the
// admin write operations on images/variants/specifications).
class ProductRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 15, 1), 100);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  buildOrder(sort) {
    const sortMap = {
      newest: [["createdAt", "DESC"]],
      priceAsc: [["basePrice", "ASC"]],
      priceDesc: [["basePrice", "DESC"]],
      bestSelling: [["soldCount", "DESC"]],
      rating: [["averageRating", "DESC"]],
    };
    return sortMap[sort] || sortMap.newest;
  }

  // Resolve a category param (UUID, slug or name) to a categoryId, or a sentinel
  // that matches nothing when the category cannot be found.
  async resolveCategoryId(catParam) {
    if (UUID_RE.test(catParam)) {
      return catParam;
    }
    const cat = await db.Category.findOne({
      where: {
        [Op.or]: [
          { slug: catParam },
          { slug: `seed-${catParam}` },
          { slug: catParam.replace(/^seed-/, "") },
          { name: { [Op.like]: `%${catParam}%` } },
        ],
      },
      attributes: ["id"],
    });
    return cat ? cat.id : NO_MATCH_ID;
  }

  // Resolve an already-parsed list of brand tokens (UUIDs and/or slugs/names) to
  // brand ids.
  async resolveBrandIdsFromList(brandList) {
    const uuidList = [];
    const slugList = [];
    brandList.forEach((b) => (UUID_RE.test(b) ? uuidList.push(b) : slugList.push(b)));

    const resolved = [...uuidList];
    if (slugList.length > 0) {
      const matched = await db.Brand.findAll({
        where: {
          [Op.or]: [
            { slug: { [Op.in]: slugList } },
            { slug: { [Op.in]: slugList.map((s) => `seed-${s}`) } },
            { slug: { [Op.in]: slugList.map((s) => s.replace(/^seed-/, "")) } },
            { name: { [Op.in]: slugList } },
          ],
        },
        attributes: ["id"],
      });
      resolved.push(...matched.map((b) => b.id));
    }
    return resolved;
  }

  async buildWhere(query) {
    const where = {};

    if (query.onlyActive === true || query.onlyActive === "true" || query.onlyActive === 1 || query.onlyActive === "1") {
      where.status = "ACTIVE";
    } else if (query.status && query.status !== "ALL" && query.status !== "all") {
      where.status = query.status;
    }

    const catParam = query.categoryId || query.category || query.categorySlug;
    if (catParam && catParam !== "all" && catParam !== "ALL") {
      where.categoryId = await this.resolveCategoryId(catParam);
    }

    const brandParam = query.brandId || query.brands || query.brand;
    if (brandParam && brandParam !== "all" && brandParam !== "ALL") {
      const brandList = Array.isArray(brandParam)
        ? brandParam
        : String(brandParam).split(",").map((s) => s.trim()).filter(Boolean);

      if (brandList.length > 0) {
        const brandIds = await this.resolveBrandIdsFromList(brandList);
        if (brandIds.length === 1) {
          where.brandId = brandIds[0];
        } else if (brandIds.length > 1) {
          where.brandId = { [Op.in]: brandIds };
        } else {
          where.brandId = NO_MATCH_ID;
        }
      }
    }

    if (query.keyword && query.keyword.trim()) {
      where.name = { [Op.like]: `%${query.keyword.trim()}%` };
    }

    if (query.minPrice || query.maxPrice) {
      where.basePrice = {};
      if (query.minPrice) {
        where.basePrice[Op.gte] = Number(query.minPrice);
      }
      if (query.maxPrice) {
        where.basePrice[Op.lte] = Number(query.maxPrice);
      }
    }

    if (query.inStock === true || query.inStock === "true" || query.inStock === "1" || query.inStock === 1) {
      where.stockQuantity = { [Op.gt]: 0 };
    }

    if (query.onSale === true || query.onSale === "true" || query.onSale === "1" || query.onSale === 1) {
      where.salePrice = { [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: 0 }] };
    }

    if (query.rating && Number(query.rating) > 0) {
      where.averageRating = { [Op.gte]: Number(query.rating) };
    }

    return where;
  }

  async findAndCountProducts(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);
    const where = await this.buildWhere(query);

    const { rows, count } = await db.Product.findAndCountAll({
      where,
      include: [
        { model: db.Category, as: "category" },
        { model: db.Brand, as: "brand" },
        { model: db.ProductImage, as: "images" },
        { model: db.ProductVariant, as: "variants" },
      ],
      distinct: true,
      order: this.buildOrder(query.sort),
      limit,
      offset,
    });

    return { rows, count, page, limit };
  }

  findDetailById(id, { onlyActive = false, transaction } = {}) {
    const where = { id };
    if (onlyActive) {
      where.status = "ACTIVE";
    }
    return db.Product.findOne({ where, include: PRODUCT_DETAIL_INCLUDE(), transaction });
  }

  findCategoryById(categoryId, { transaction } = {}) {
    return db.Category.findByPk(categoryId, { transaction });
  }

  findBrandById(brandId, { transaction } = {}) {
    return db.Brand.findByPk(brandId, { transaction });
  }

  // Returns a product (incl. soft-deleted) that already owns the slug, excluding
  // the given product id — used to build a unique slug.
  findBySlug(slug, { excludeId = null, transaction } = {}) {
    return db.Product.findOne({
      where: { slug, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
      paranoid: false,
      transaction,
    });
  }

  createProduct(data, { transaction } = {}) {
    return db.Product.create(data, { transaction });
  }

  updateProduct(product, changes, { transaction } = {}) {
    return product.update(changes, { transaction });
  }

  destroyProduct(product, { transaction } = {}) {
    return product.destroy({ transaction });
  }

  findImagesByProduct(productId, { transaction } = {}) {
    return db.ProductImage.findAll({ where: { productId }, transaction });
  }

  destroyImagesByProduct(productId, { transaction } = {}) {
    return db.ProductImage.destroy({ where: { productId }, transaction });
  }

  bulkCreateImages(images, { transaction } = {}) {
    return db.ProductImage.bulkCreate(images, { transaction });
  }

  destroyVariantsByProduct(productId, { transaction } = {}) {
    return db.ProductVariant.destroy({ where: { productId }, force: true, transaction });
  }

  bulkCreateVariants(variants, { transaction } = {}) {
    return db.ProductVariant.bulkCreate(variants, { transaction });
  }

  destroySpecificationsByProduct(productId, { transaction } = {}) {
    return db.ProductSpecification.destroy({ where: { productId }, transaction });
  }

  createSpecification(data, { transaction } = {}) {
    return db.ProductSpecification.create(data, { transaction });
  }

  findOrCreateSpecificationDefinition(categoryId, key, defaults, { transaction } = {}) {
    return db.SpecificationDefinition.findOrCreate({
      where: { categoryId, key },
      defaults,
      transaction,
    });
  }
}

module.exports = new ProductRepository();
