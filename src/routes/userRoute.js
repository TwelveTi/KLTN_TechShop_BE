const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { validateUpdateProfile } = require("../middlewares/authValidation");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { uploadAvatar } = require("../middlewares/uploadMiddleware");
const asyncHandler = require("../utils/asyncHandler");

// The signed-in user acting on their own account. Admin management of other
// users lives in adminUserRoute (same controller, different gate).
router.get("/users/me", authMiddleware, asyncHandler(userController.getMe));
router.put("/users/me", authMiddleware, validateUpdateProfile, asyncHandler(userController.updateMe));
router.post("/users/me/avatar", authMiddleware, uploadAvatar, asyncHandler(userController.uploadAvatar));

module.exports = router;
