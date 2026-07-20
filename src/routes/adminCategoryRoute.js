const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  validateIdParam,
  validateCategory,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/categories", asyncHandler(adminController.getAllCategories));
router.post("/admin/categories", validateCategory, asyncHandler(adminController.createCategory));
router.put("/admin/categories/:id", validateIdParam(), validateCategory, asyncHandler(adminController.updateCategory));
router.delete("/admin/categories/:id", validateIdParam(), asyncHandler(adminController.deleteCategory));

module.exports = router;
