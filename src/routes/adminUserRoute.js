const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  validateIdParam,
  validateCreateUser,
  validateUpdateUser,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

// Same controller as `/users/me`, different audience: adminRoute has already
// applied authMiddleware + checkRole(["ADMIN"]) before this router is reached.
router.get("/admin/users", asyncHandler(userController.getAllUsers));
router.get("/admin/users/:id", validateIdParam(), asyncHandler(userController.getUserById));
router.post("/admin/users", validateCreateUser, asyncHandler(userController.createUser));
router.put("/admin/users/:id", validateIdParam(), validateUpdateUser, asyncHandler(userController.updateUser));
router.delete("/admin/users/:id", validateIdParam(), asyncHandler(userController.deleteUser));

module.exports = router;
