const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validateRegister,
  validateLogin,
  validateLogout,
  validateUpdateProfile,
} = require("../middlewares/authValidation");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { uploadAvatar } = require("../middlewares/uploadMiddleware");
const asyncHandler = require("../utils/asyncHandler");

router.post("/auth/register", validateRegister, asyncHandler(authController.register));
router.post("/auth/login", validateLogin, asyncHandler(authController.login));
router.post("/auth/logout", validateLogout, asyncHandler(authController.logout));
router.post("/auth/refresh", asyncHandler(authController.refresh));
router.get("/auth/me", authMiddleware, asyncHandler(authController.me));
router.put("/auth/me", authMiddleware, validateUpdateProfile, asyncHandler(authController.updateMe));
router.post("/auth/me/avatar", authMiddleware, uploadAvatar, asyncHandler(authController.uploadAvatar));

module.exports = router;
