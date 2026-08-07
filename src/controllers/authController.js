const authService = require("../services/authService");
const uploadService = require("../services/uploadService");
const {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} = require("../utils/authCookies");
const APIResponse = require("../utils/ApiResponse");

class AuthController {
  async register(req, res) {
    const result = await authService.register(req.body, {
      ipAddress: req.ip,
      deviceInfo: req.get("user-agent"),
      requestId: req.requestId,
    });

    // No token / cookie on register: the user must verify their email and sign in.
    return APIResponse.success(
      res,
      "Registration successful. Please verify your email, then sign in.",
      { user: result.user },
      201,
    );
  }

  async login(req, res) {
    const result = await authService.login(req.body, {
      ipAddress: req.ip,
      deviceInfo: req.get("user-agent"),
    });

    setRefreshTokenCookie(res, result.refreshToken);

    return APIResponse.success(res, "Login successfully", {
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  async checkEmail(req, res) {
    const result = await authService.checkEmailAvailability(req.query.email);

    return APIResponse.success(res, "Email check", result);
  }

  async me(req, res) {
    const user = await authService.getProfile(req.user.id);

    return APIResponse.success(res, "Get profile successfully", user);
  }

  async updateMe(req, res) {
    const user = await authService.updateProfile(req.user.id, req.body);

    return APIResponse.success(res, "Update profile successfully", user);
  }

  async uploadAvatar(req, res) {
    const avatar = await uploadService.uploadAvatar(req.file, req.user.avatarPublicId, {
      requestId: req.id,
    });
    const user = await authService.updateAvatar(req.user.id, avatar);

    return APIResponse.success(res, "Upload avatar successfully", user);
  }

  async refresh(req, res) {
    const refreshToken = getRefreshTokenFromCookie(req);

    try {
      const result = await authService.refresh(refreshToken, {
        ipAddress: req.ip,
        deviceInfo: req.get("user-agent"),
      });

      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken);
      }

      return APIResponse.success(res, "Refresh token successfully", {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      clearRefreshTokenCookie(res);
      throw error;
    }
  }

  async logout(req, res) {
    const refreshToken = getRefreshTokenFromCookie(req);
    const result = await authService.logout(refreshToken);

    clearRefreshTokenCookie(res);

    return APIResponse.success(res, result.message);
  }

  // The email button links here. We verify the token, then redirect the user
  // straight to the frontend home page with a status flag the UI can read.
  async verifyEmail(req, res) {
    const { token } = req.query;
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

    try {
      const result = await authService.verifyEmail(token, {
        ipAddress: req.ip,
        deviceInfo: req.get("user-agent"),
      });

      // Sign the user in: set the refresh cookie so the frontend can exchange
      // it for an access token on load (refreshSession) — the link logs them in.
      setRefreshTokenCookie(res, result.refreshToken);

      const status = result.alreadyVerified ? "already" : "success";
      return res.redirect(`${frontendUrl}/?verified=${status}`);
    } catch {
      return res.redirect(`${frontendUrl}/?verified=error`);
    }
  }

  async resendVerification(req, res) {
    const result = await authService.resendVerification(req.user.id, {
      requestId: req.requestId,
    });

    return APIResponse.success(res, result.message);
  }

  // Google redirects here after consent. Passport has already put the extracted
  // Google profile on req.user; we turn it into a TechShop session and, like the
  // email verification link, set the refresh cookie and redirect to the frontend
  // (which signs the user in on load via refreshSession).
  async googleCallback(req, res) {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

    try {
      const result = await authService.loginWithGoogle(req.user, {
        ipAddress: req.ip,
        deviceInfo: req.get("user-agent"),
      });

      setRefreshTokenCookie(res, result.refreshToken);

      return res.redirect(`${frontendUrl}/?login=google`);
    } catch {
      return res.redirect(`${frontendUrl}/auth?oauth=error`);
    }
  }
}

module.exports = new AuthController();
