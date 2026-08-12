const passwordService = require("../services/passwordService");
const { getRefreshTokenFromCookie } = require("../utils/authCookies");
const APIResponse = require("../utils/ApiResponse");

class PasswordController {
  async forgotPassword(req, res) {
    const result = await passwordService.forgotPassword(req.body.email, {
      requestId: req.requestId,
    });

    return APIResponse.success(res, result.message);
  }

  async resendResetOtp(req, res) {
    const result = await passwordService.resendResetOtp(req.body.email, {
      requestId: req.requestId,
    });

    return APIResponse.success(res, result.message);
  }

  async verifyResetOtp(req, res) {
    const result = await passwordService.verifyOtp(req.body.email, req.body.otp);

    return APIResponse.success(res, "OTP verified successfully", result);
  }

  async resetPassword(req, res) {
    const result = await passwordService.resetPassword(req.body.resetToken, req.body.newPassword);

    return APIResponse.success(res, result.message);
  }

  async changePassword(req, res) {
    // Identify the current session so it can be preserved; userId always comes
    // from the authenticated context (req.user), never from the request body.
    const currentRefreshToken = getRefreshTokenFromCookie(req);

    const result = await passwordService.changePassword(
      req.user.id,
      { currentPassword: req.body.currentPassword, newPassword: req.body.newPassword },
      currentRefreshToken,
    );

    return APIResponse.success(res, result.message, {
      revokedOtherSessions: result.revokedOtherSessions,
      currentSessionKept: result.currentSessionKept,
    });
  }
}

module.exports = new PasswordController();
