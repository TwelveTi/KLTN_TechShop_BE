const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  validateIdParam,
  validateCreateUser,
  validateUpdateUser,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/users", asyncHandler(adminController.getAllUsers));
router.get("/admin/users/:id", validateIdParam(), asyncHandler(adminController.getUserById));
router.post("/admin/users", validateCreateUser, asyncHandler(adminController.createUser));
router.put("/admin/users/:id", validateIdParam(), validateUpdateUser, asyncHandler(adminController.updateUser));
router.delete("/admin/users/:id", validateIdParam(), asyncHandler(adminController.deleteUser));

module.exports = router;
