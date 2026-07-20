const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  validateIdParam,
  validateBrand,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/brands", asyncHandler(adminController.getAllBrands));
router.post("/admin/brands", validateBrand, asyncHandler(adminController.createBrand));
router.put("/admin/brands/:id", validateIdParam(), validateBrand, asyncHandler(adminController.updateBrand));
router.delete("/admin/brands/:id", validateIdParam(), asyncHandler(adminController.deleteBrand));

module.exports = router;
