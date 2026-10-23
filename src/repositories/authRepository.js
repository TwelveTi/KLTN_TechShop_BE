const { Op } = require("sequelize");
const db = require("../models");
const { loginLockoutKey } = require("../utils/tokenHash");

// Refresh token vừa xoay vòng vẫn dùng được thêm 30 giây cho các request đang bay.
const REFRESH_TOKEN_REUSE_GRACE_MS = 30 * 1000;

// Data-access for authentication: session-scoped reads of users, auth providers
// and refresh tokens. Creating an account is userRepository's job.
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

  // Account creation lives in userRepository — auth only reads users and stamps
  // session-lifecycle fields (lastLoginAt, emailVerifiedAt) on them.
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

  removeLocalProvider(userId, { transaction } = {}) {
    return db.AuthProvider.destroy({ where: { userId, provider: "LOCAL" }, transaction });
  }

  // ---- Refresh tokens ----
  createRefreshToken(data, { transaction } = {}) {
    return db.RefreshToken.create(data, { transaction });
  }

  // Logout cũng cho token hết hạn ngay, như passwordRepository, để reuse-grace
  // của refresh không xoay được token vừa đăng xuất.
  async revokeByTokenHash(tokenHash, { transaction } = {}) {
    const now = new Date();
    const [count] = await db.RefreshToken.update(
      { revokedAt: now, expiresAt: now },
      { where: { tokenHash, revokedAt: null }, transaction },
    );
    return count;
  }

  async revokeAllSessions(userId, { transaction } = {}) {
    const now = new Date();
    const [count] = await db.RefreshToken.update(
      { revokedAt: now, expiresAt: now },
      { where: { userId, expiresAt: { [Op.gt]: now } }, transaction },
    );
    return count;
  }

  // A refresh token that is still usable: not expired, and either not revoked or
  // revoked within the reuse-grace window.
  // Phiên còn sống: chưa hết hạn, chưa bị thu hồi, hoặc vừa được xoay vòng trong 30 giây
  // (request song song còn cầm token cũ). Đăng xuất, thu hồi, đổi mật khẩu đều đặt expiresAt = now
  // nên bị chặn ngay, không có 30 giây đó.
  findLiveSession(sessionId, userId, now = new Date()) {
    return db.RefreshToken.findOne({
      where: {
        id: sessionId,
        userId,
        expiresAt: { [Op.gt]: now },
        [Op.or]: [
          { revokedAt: null },
          { revokedAt: { [Op.gt]: new Date(now.getTime() - REFRESH_TOKEN_REUSE_GRACE_MS) } },
        ],
      },
      attributes: ["id"],
    });
  }

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

  // ---- Khoá đăng nhập theo email khi sai nhiều lần ----
  findLoginLockout(email, { transaction } = {}) {
    return db.LoginLockout.findByPk(loginLockoutKey(email), { transaction });
  }

  async recordFailedLogin(email, { now, maxAttempts, lockMs }) {
    const emailKey = loginLockoutKey(email);
    const [row] = await db.LoginLockout.findOrCreate({ where: { emailKey }, defaults: { emailKey, failedCount: 0 } });
    // Lần khoá trước đã hết hạn thì đếm lại từ đầu, không cộng dồn vào lần khoá cũ.
    const expired = row.lockedUntil && row.lockedUntil <= now;
    const failedCount = (expired ? 0 : row.failedCount) + 1;
    const lockedUntil = failedCount >= maxAttempts ? new Date(now.getTime() + lockMs) : expired ? null : row.lockedUntil;
    await row.update({ failedCount: failedCount >= maxAttempts ? 0 : failedCount, lockedUntil, lastFailedAt: now });
    return { failedCount, lockedUntil };
  }

  clearLoginLockout(email, { transaction } = {}) {
    return db.LoginLockout.destroy({ where: { emailKey: loginLockoutKey(email) }, transaction });
  }

  updateRefreshToken(token, changes, { transaction } = {}) {
    return token.update(changes, { transaction });
  }
}

module.exports = new AuthRepository();
module.exports.REFRESH_TOKEN_REUSE_GRACE_MS = REFRESH_TOKEN_REUSE_GRACE_MS;
