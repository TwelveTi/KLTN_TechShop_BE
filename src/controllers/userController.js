const userService = require("../services/userService");
const uploadService = require("../services/uploadService");
const APIResponse = require("../utils/ApiResponse");

// Serves both audiences over the same service: `/users/me*` for the signed-in
// user acting on themselves, `/admin/users*` for an admin acting on someone
// else. The admin routes are gated by authMiddleware + checkRole in adminRoute.
class UserController {
  // ---- Self-service ----
  async getMe(req, res) {
    const user = await userService.getMyProfile(req.user.id);

    return APIResponse.success(res, "Get profile successfully", user);
  }

  async updateMe(req, res) {
    const user = await userService.updateMyProfile(req.user.id, req.body);

    return APIResponse.success(res, "Update profile successfully", user);
  }

  async uploadAvatar(req, res) {
    const avatar = await uploadService.uploadAvatar(req.file, req.user.avatarPublicId, {
      requestId: req.requestId,
    });
    const user = await userService.updateMyAvatar(req.user.id, avatar);

    return APIResponse.success(res, "Upload avatar successfully", user);
  }

  // ---- Admin management ----
  async getAllUsers(req, res) {
    const result = await userService.getAllUsers(req.query);

    return APIResponse.success(res, "Get users successfully", result);
  }

  async getUserById(req, res) {
    const user = await userService.getUserById(req.params.id);

    return APIResponse.success(res, "Get user successfully", user);
  }

  async createUser(req, res) {
    const user = await userService.createUser(req.body);

    return APIResponse.success(res, "User created successfully", user, 201);
  }

  async updateUser(req, res) {
    const user = await userService.updateUser(req.params.id, req.body);

    return APIResponse.success(res, "User updated successfully", user);
  }

  async deleteUser(req, res) {
    const result = await userService.deleteUser(req.params.id);

    return APIResponse.success(res, result.message);
  }
}

module.exports = new UserController();
