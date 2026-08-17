const db = require("../models");

// Sole data-access layer for the `users` table and the rows bootstrapped
// alongside a new account (LOCAL auth provider, cart, wishlist). Both the
// customer-facing profile endpoints and the admin user management go through
// here, so account creation can never drift between the two paths.
class UserRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // ---- Reads ----
  findUserById(id, { transaction } = {}) {
    return db.User.findByPk(id, { transaction });
  }

  // Admin detail view: includes the relations the admin UI renders.
  findUserByIdWithRelations(id) {
    return db.User.findByPk(id, {
      include: [
        { model: db.AuthProvider, as: "authProviders", attributes: { exclude: ["passwordHash"] } },
        { model: db.Cart, as: "cart" },
        { model: db.Wishlist, as: "wishlist" },
      ],
    });
  }

  findUserByEmail(email, { paranoid = true, attributes, transaction } = {}) {
    return db.User.findOne({
      where: { email },
      paranoid,
      ...(attributes ? { attributes } : {}),
      transaction,
    });
  }

  findAndCountUsers({ limit, offset } = {}) {
    return db.User.findAndCountAll({
      attributes: { exclude: ["deletedAt"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  // ---- Writes ----
  createUser(data, { transaction } = {}) {
    return db.User.create(data, { transaction });
  }

  updateUser(user, changes, { transaction } = {}) {
    return user.update(changes, { transaction });
  }

  destroyUser(user, { transaction } = {}) {
    return user.destroy({ transaction });
  }

  // ---- New-account bootstrap ----
  createAuthProvider(data, { transaction } = {}) {
    return db.AuthProvider.create(data, { transaction });
  }

  createCart(userId, { transaction } = {}) {
    return db.Cart.create({ userId }, { transaction });
  }

  createWishlist(userId, { transaction } = {}) {
    return db.Wishlist.create({ userId }, { transaction });
  }
}

module.exports = new UserRepository();
