const authService = require("../services/authService");
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

      // Lần đầu thì bấm link là đăng nhập luôn: đặt refresh cookie để FE đổi lấy
      // access token khi tải trang (refreshSession).
      //
      // Lần bấm lại thì `refreshToken` là `null` và KHÔNG có cookie nào được đặt —
      // xem chú thích ở `authService.verifyEmail`. Người dùng vẫn được chuyển về
      // FE với `verified=already`, chỉ là phải đăng nhập như bình thường.
      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken);
      }

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
      return res.redirect(`${frontendUrl}/login?oauth=error`);
    }
  }
}

module.exports = new AuthController();
