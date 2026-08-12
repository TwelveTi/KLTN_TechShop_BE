const { Op } = require("sequelize");
const db = require("../models");
const { PASSWORD_RESET_PURPOSE } = require("../configs/passwordConfig");

// Data-access for the password-management flow: the user + LOCAL provider it
// resets, the OTP records, and the session (refresh token) revocation on
// success. Read methods accept a boolean `lock`; instance-mutation methods take
// the loaded+locked model so the caller's transaction lock is preserved.
class PasswordRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // ---- Users ----
  // ACTIVE user that has a LOCAL (password) login. Google-only accounts return
  // null (there is no password to reset).
  findActiveLocalUserByEmail(email, { transaction } = {}) {
    const normalizedEmail = String(email || "").toLowerCase().trim();

    if (!normalizedEmail) {
      return Promise.resolve(null);
    }

    return db.User.findOne({
      where: { email: normalizedEmail, status: "ACTIVE" },
      include: [
        {
          model: db.AuthProvider,
          as: "authProviders",
          where: { provider: "LOCAL" },
          required: true,
        },
      ],
      transaction,
    });
  }

  // ---- Auth provider (LOCAL credential) ----
  findLocalProviderByUserId(userId, { transaction, lock } = {}) {
    return db.AuthProvider.findOne({
      where: { userId, provider: "LOCAL" },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  updateProviderPassword(provider, passwordHash, { transaction } = {}) {
    return provider.update({ passwordHash }, { transaction });
  }

  // ---- OTP records (scoped to PASSWORD_RESET) ----
  findLatestOtpByUser(userId, { transaction, lock } = {}) {
    return db.OtpVerification.findOne({
      where: { userId, purpose: PASSWORD_RESET_PURPOSE },
      order: [["createdAt", "DESC"]],
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findActivePendingOtpByUser(userId, { transaction, lock } = {}) {
    return db.OtpVerification.findOne({
      where: { userId, purpose: PASSWORD_RESET_PURPOSE, usedAt: null, verifiedAt: null },
      order: [["createdAt", "DESC"]],
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findVerifiedOtpByResetTokenHash(resetTokenHash, { transaction, lock } = {}) {
    return db.OtpVerification.findOne({
      where: {
        resetTokenHash,
        purpose: PASSWORD_RESET_PURPOSE,
        usedAt: null,
        verifiedAt: { [Op.ne]: null },
      },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  invalidateActiveOtpByUser(userId, { transaction } = {}) {
    return db.OtpVerification.update(
      { usedAt: new Date() },
      { where: { userId, purpose: PASSWORD_RESET_PURPOSE, usedAt: null }, transaction },
    );
  }

  createOtp({ userId, otpHash, expiresAt, attempts = 0 }, { transaction } = {}) {
    return db.OtpVerification.create(
      { userId, purpose: PASSWORD_RESET_PURPOSE, otpHash, attempts, expiresAt },
      { transaction },
    );
  }

  markOtpUsed(record, { transaction } = {}) {
    return record.update({ usedAt: new Date() }, { transaction });
  }

  incrementOtpAttempts(record, { markUsed = false, transaction } = {}) {
    const updates = { attempts: record.attempts + 1 };
    if (markUsed) {
      updates.usedAt = new Date();
    }
    return record.update(updates, { transaction });
  }

  markOtpVerified(record, { resetTokenHash, resetTokenExpiresAt, transaction } = {}) {
    return record.update(
      { verifiedAt: new Date(), resetTokenHash, resetTokenExpiresAt },
      { transaction },
    );
  }

  // ---- Sessions (refresh tokens) ----
  // Security revocations EXPIRE the tokens (expiresAt = now) in addition to
  // revokedAt, so the refresh reuse-grace cannot rotate a just-revoked token
  // back into a valid one.
  async revokeAllActiveSessions(userId, { transaction } = {}) {
    const now = new Date();
    const [count] = await db.RefreshToken.update(
      { revokedAt: now, expiresAt: now },
      { where: { userId, expiresAt: { [Op.gt]: now } }, transaction },
    );
    return count;
  }

  async revokeOtherSessions(userId, currentTokenHash, { transaction } = {}) {
    const now = new Date();
    const [count] = await db.RefreshToken.update(
      { revokedAt: now, expiresAt: now },
      {
        where: {
          userId,
          expiresAt: { [Op.gt]: now },
          tokenHash: { [Op.ne]: currentTokenHash },
        },
        transaction,
      },
    );
    return count;
  }
}

module.exports = new PasswordRepository();
