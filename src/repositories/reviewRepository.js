const { fn, col } = require("sequelize");
const db = require("../models");

// Only these user fields are ever exposed on a public review. Never leak email,
// phone, role, status, tokens, etc.
const PUBLIC_USER_ATTRIBUTES = ["id", "fullName", "avatarUrl"];

// Data-access for product reviews and the denormalized product rating fields.
class ReviewRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  findActiveProductById(productId, { transaction } = {}) {
    return db.Product.findOne({ where: { id: productId, status: "ACTIVE" }, transaction });
  }

  findAndCountByProductStatus(productId, status, { limit, offset, transaction } = {}) {
    return db.Review.findAndCountAll({
      where: { productId, status },
      include: [{ model: db.User, as: "user", attributes: PUBLIC_USER_ATTRIBUTES }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      transaction,
    });
  }

  // GROUP BY rating (at most 5 rows) — never loads individual reviews.
  getRatingDistribution(productId, status, { transaction } = {}) {
    return db.Review.findAll({
      where: { productId, status },
      attributes: ["rating", [fn("COUNT", col("id")), "count"]],
      group: ["rating"],
      raw: true,
      transaction,
    });
  }

  getRatingAggregate(productId, status, { transaction } = {}) {
    return db.Review.findOne({
      where: { productId, status },
      attributes: [
        [fn("COUNT", col("id")), "count"],
        [fn("AVG", col("rating")), "avg"],
      ],
      raw: true,
      transaction,
    });
  }

  updateProductRating(productId, { averageRating, reviewCount }, { transaction } = {}) {
    return db.Product.update({ averageRating, reviewCount }, { where: { id: productId }, transaction });
  }

  findById(reviewId, { transaction } = {}) {
    return db.Review.findByPk(reviewId, { transaction });
  }

  findByIdWithUser(reviewId, { transaction } = {}) {
    return db.Review.findByPk(reviewId, {
      include: [{ model: db.User, as: "user", attributes: PUBLIC_USER_ATTRIBUTES }],
      transaction,
    });
  }

  findExisting(userId, productId, { transaction } = {}) {
    return db.Review.findOne({ where: { userId, productId }, transaction });
  }

  create(data, { transaction } = {}) {
    return db.Review.create(data, { transaction });
  }

  update(review, changes, { transaction } = {}) {
    return review.update(changes, { transaction });
  }

  destroy(review, { transaction } = {}) {
    return review.destroy({ transaction });
  }
}

module.exports = new ReviewRepository();
