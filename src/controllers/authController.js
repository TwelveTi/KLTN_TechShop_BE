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
    });

    setRefreshTokenCookie(res, result.refreshToken);

    return APIResponse.success(res, "Register successfully", {
      user: result.user,
      accessToken: result.accessToken,
    }, 201);
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
}

module.exports = new AuthController();
