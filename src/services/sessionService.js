const { Op } = require("sequelize");
const db = require("../models");
const AppError = require("../utils/AppError");
const { hashToken } = require("../utils/tokenHash");
const { parseUserAgent } = require("../utils/userAgent");

// A "session/device" is one row in refresh_tokens. It is ACTIVE when it has not
// been revoked and has not expired. The session matching the caller's refresh
// cookie is flagged as `current`.
class SessionService {
  activeWhere(userId, now = new Date()) {
    return {
      userId,
      revokedAt: null,
      expiresAt: { [Op.gt]: now },
    };
  }

  async listSessions(userId, currentRefreshToken) {
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    const sessions = await db.RefreshToken.findAll({
      where: this.activeWhere(userId),
      order: [["createdAt", "DESC"]],
    });

    return sessions.map((session) => {
      const device = parseUserAgent(session.deviceInfo);

      return {
        id: session.id,
        device: device.label,
        browser: device.browser,
        os: device.os,
        deviceType: device.deviceType,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: currentHash ? session.tokenHash === currentHash : false,
      };
    });
  }

  async revokeSession(userId, sessionId, currentRefreshToken) {
    const session = await db.RefreshToken.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new AppError("Session not found", 404);
    }

    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;
    const isCurrent = currentHash ? session.tokenHash === currentHash : false;

    if (!session.revokedAt) {
      await session.update({ revokedAt: new Date() });
    }

    return { isCurrent };
  }

  async revokeOtherSessions(userId, currentRefreshToken) {
    // We can only revoke "others" if we know which session is the current one.
    if (!currentRefreshToken) {
      throw new AppError("Current session not found. Please sign in again.", 400);
    }

    const currentHash = hashToken(currentRefreshToken);
    const now = new Date();

    const [revokedCount] = await db.RefreshToken.update(
      { revokedAt: now },
      {
        where: {
          ...this.activeWhere(userId, now),
          tokenHash: { [Op.ne]: currentHash },
        },
      },
    );

    return { revokedCount };
  }
}

module.exports = new SessionService();
