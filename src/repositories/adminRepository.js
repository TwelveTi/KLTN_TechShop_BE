const { Op } = require("sequelize");
const db = require("../models");

// Data-access for admin management of users, categories and brands.
class AdminRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // ---- Users ----
  findAndCountUsers({ limit, offset } = {}) {
    return db.User.findAndCountAll({
      attributes: { exclude: ["deletedAt"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  findUserByIdWithRelations(id) {
    return db.User.findByPk(id, {
      include: [
        { model: db.AuthProvider, as: "authProviders", attributes: { exclude: ["passwordHash"] } },
        { model: db.Cart, as: "cart" },
        { model: db.Wishlist, as: "wishlist" },
      ],
    });
  }

  findUserByEmail(email, { paranoid = true } = {}) {
    return db.User.findOne({ where: { email }, paranoid });
  }

  createUser(data, { transaction } = {}) {
    return db.User.create(data, { transaction });
  }

  createAuthProvider(data, { transaction } = {}) {
    return db.AuthProvider.create(data, { transaction });
  }

  createCart(userId, { transaction } = {}) {
    return db.Cart.create({ userId }, { transaction });
  }

  createWishlist(userId, { transaction } = {}) {
    return db.Wishlist.create({ userId }, { transaction });
  }

  updateUser(user, changes, { transaction } = {}) {
    return user.update(changes, { transaction });
  }

  destroyUser(user, { transaction } = {}) {
    return user.destroy({ transaction });
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
