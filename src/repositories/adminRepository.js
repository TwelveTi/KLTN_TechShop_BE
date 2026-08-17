const { Op } = require("sequelize");
const db = require("../models");

// Data-access for admin management of categories and brands. Users are owned by
// userRepository, shared with the customer-facing profile endpoints.
class AdminRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // ---- Categories ----
  findAllCategories() {
    return db.Category.findAll({
      include: [{ model: db.Category, as: "children" }],
      order: [["sortOrder", "ASC"], ["createdAt", "DESC"]],
    });
  }

  findCategoryById(id) {
    return db.Category.findByPk(id);
  }

  findCategoryBySlug(slug, { excludeId = null } = {}) {
    return db.Category.findOne({
      where: { slug, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
      paranoid: false,
    });
  }

  createCategory(data) {
    return db.Category.create(data);
  }

  updateCategory(category, changes) {
    return category.update(changes);
  }

  destroyCategory(category) {
    return category.destroy();
  }

  // ---- Brands ----
  findAllBrands() {
    return db.Brand.findAll({ order: [["createdAt", "DESC"]] });
  }

  findBrandById(id) {
    return db.Brand.findByPk(id);
  }

  findBrandBySlug(slug, { excludeId = null } = {}) {
    return db.Brand.findOne({
      where: { slug, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
      paranoid: false,
    });
  }

  createBrand(data) {
    return db.Brand.create(data);
  }

  updateBrand(brand, changes) {
    return brand.update(changes);
  }

  destroyBrand(brand) {
    return brand.destroy();
  }
}

module.exports = new AdminRepository();
