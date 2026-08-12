const { Op } = require("sequelize");
const db = require("../models");

// Data-access for authentication: users, auth providers, refresh tokens, and the
// cart/wishlist rows bootstrapped on account creation.
class AuthRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // ---- Users ----
  findUserById(id, { transaction } = {}) {
    return db.User.findByPk(id, { transaction });
  }

  findUserByEmail(email, { paranoid = true, attributes, transaction } = {}) {
    return db.User.findOne({
      where: { email },
      paranoid,
      ...(attributes ? { attributes } : {}),
      transaction,
    });
  }

  // User + their LOCAL auth provider (for password login).
  findUserWithLocalProviderByEmail(email) {
    return db.User.findOne({
      where: { email },
      include: [
        {
          model: db.AuthProvider,
          as: "authProviders",
          where: { provider: "LOCAL" },
          required: true,
        },
      ],
    });
  }

  createUser(data, { transaction } = {}) {
    return db.User.create(data, { transaction });
  }

  updateUser(user, changes, { transaction } = {}) {
    return user.update(changes, { transaction });
  }

  // ---- Auth providers ----
  findGoogleProviderWithUser(providerUserId) {
    return db.AuthProvider.findOne({
      where: { provider: "GOOGLE", providerUserId },
      include: [{ model: db.User, as: "user" }],
    });
  }

  createAuthProvider(data, { transaction } = {}) {
    return db.AuthProvider.create(data, { transaction });
  }

  updateAuthProvider(provider, changes, { transaction } = {}) {
    return provider.update(changes, { transaction });
  }

  // ---- Cart / Wishlist bootstrap ----
  createCart(userId, { transaction } = {}) {
    return db.Cart.create({ userId }, { transaction });
  }

  createWishlist(userId, { transaction } = {}) {
    return db.Wishlist.create({ userId }, { transaction });
  }

  // ---- Refresh tokens ----
  createRefreshToken(data, { transaction } = {}) {
    return db.RefreshToken.create(data, { transaction });
  }

  async revokeByTokenHash(tokenHash, { transaction } = {}) {
    const [count] = await db.RefreshToken.update(
      { revokedAt: new Date() },
      { where: { tokenHash, revokedAt: null }, transaction },
    );
    return count;
  }

  // A refresh token that is still usable: not expired, and either not revoked or
  // revoked within the reuse-grace window.
  findRefreshTokenForRotation(tokenHash, { now, graceStartedAt, transaction, lock } = {}) {
    return db.RefreshToken.findOne({
      where: {
        tokenHash,
        expiresAt: { [Op.gt]: now },
        [Op.or]: [
          { revokedAt: null },
          { revokedAt: { [Op.gt]: graceStartedAt } },
        ],
      },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  updateRefreshToken(token, changes, { transaction } = {}) {
    return token.update(changes, { transaction });
  }
}

module.exports = new AuthRepository();
