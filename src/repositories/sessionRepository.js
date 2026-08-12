const { Op } = require("sequelize");
const db = require("../models");

// Data-access for sessions/devices (rows in refresh_tokens). A session is
// ACTIVE when not revoked and not expired.
class SessionRepository {
  activeWhere(userId, now = new Date()) {
    return {
      userId,
      revokedAt: null,
      expiresAt: { [Op.gt]: now },
    };
  }

  findActiveByUser(userId, { transaction } = {}) {
    return db.RefreshToken.findAll({
      where: this.activeWhere(userId),
      order: [["createdAt", "DESC"]],
      transaction,
    });
  }

  findByIdForUser(sessionId, userId, { transaction, lock } = {}) {
    return db.RefreshToken.findOne({
      where: { id: sessionId, userId },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  revoke(session, { transaction } = {}) {
    return session.update({ revokedAt: new Date() }, { transaction });
  }

  async revokeOthers(userId, currentTokenHash, { transaction } = {}) {
    const now = new Date();
    const [revokedCount] = await db.RefreshToken.update(
      { revokedAt: now },
      {
        where: {
          ...this.activeWhere(userId, now),
          tokenHash: { [Op.ne]: currentTokenHash },
        },
        transaction,
      },
    );
    return revokedCount;
  }
}

module.exports = new SessionRepository();
