const sessionService = require("../services/sessionService");
const { getRefreshTokenFromCookie, clearRefreshTokenCookie } = require("../utils/authCookies");
const APIResponse = require("../utils/ApiResponse");

class SessionController {
  async getSessions(req, res) {
    const currentRefreshToken = getRefreshTokenFromCookie(req);
    const sessions = await sessionService.listSessions(req.user.id, currentRefreshToken);

    return APIResponse.success(res, "Get sessions successfully", { sessions });
  }

  async revokeSession(req, res) {
    const currentRefreshToken = getRefreshTokenFromCookie(req);
    const result = await sessionService.revokeSession(req.user.id, req.params.id, currentRefreshToken);

    // If the user revoked the session they are currently on, drop the cookie too.
    if (result.isCurrent) {
      clearRefreshTokenCookie(res);
    }

    return APIResponse.success(res, "Session revoked successfully", { current: result.isCurrent });
  }

  async revokeOtherSessions(req, res) {
    const currentRefreshToken = getRefreshTokenFromCookie(req);
    const result = await sessionService.revokeOtherSessions(req.user.id, currentRefreshToken);

    return APIResponse.success(res, "Signed out from other devices", {
      revokedCount: result.revokedCount,
    });
  }
}

module.exports = new SessionController();
