const { Op, fn, col } = require("sequelize");
const db = require("../models");

// Data-access for the PUBLIC catalog taxonomy: the category tree and the brand
// list a shopper browses by.
//
// Deliberately separate from adminRepository even though both read the same two
// tables: this one only ever sees active rows and never writes, the same way
// orderRepository and adminOrderRepository split the Order table by audience.
class CatalogRepository {
  findActiveCategories() {
    return db.Category.findAll({
      where: { isActive: true },
      attributes: ["id", "parentId", "name", "slug", "description", "imageUrl", "sortOrder"],
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"],
      ],
    });
  }

  findActiveCategoryBySlug(slug) {
    return db.Category.findOne({
      where: { slug, isActive: true },
      attributes: ["id", "parentId", "name", "slug", "description", "imageUrl", "sortOrder"],
    });
  }

  findActiveBrands() {
    return db.Brand.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "slug", "description", "logoUrl"],
      order: [["name", "ASC"]],
    });
  }

  findActiveBrandBySlug(slug) {
    return db.Brand.findOne({
      where: { slug, isActive: true },
      attributes: ["id", "name", "slug", "description", "logoUrl"],
    });
  }

  // One GROUP BY per taxonomy instead of a correlated subquery per row: two
  // cheap queries the service merges in memory, which stays readable and does
  // not degrade as the catalogue grows.
  countActiveProductsByCategory() {
    return db.Product.findAll({
      attributes: ["categoryId", [fn("COUNT", col("id")), "total"]],
      where: { status: "ACTIVE", categoryId: { [Op.ne]: null } },
      group: ["categoryId"],
      raw: true,
    });
  }

  countActiveProductsByBrand() {
    return db.Product.findAll({
      attributes: ["brandId", [fn("COUNT", col("id")), "total"]],
      where: { status: "ACTIVE", brandId: { [Op.ne]: null } },
      group: ["brandId"],
      raw: true,
    });
  }

  countActiveProducts() {
    return db.Product.count({ where: { status: "ACTIVE" } });
  }
}

module.exports = new CatalogRepository();
