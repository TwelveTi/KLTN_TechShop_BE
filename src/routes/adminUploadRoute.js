const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { validateDeleteUploadedImage } = require("../middlewares/adminValidation");
const { uploadProductImages } = require("../middlewares/uploadMiddleware");
const asyncHandler = require("../utils/asyncHandler");

router.post(
  "/admin/uploads/products/images",
  uploadProductImages,
  asyncHandler(adminController.uploadProductImages),
);
router.delete(
  "/admin/uploads/images",
  validateDeleteUploadedImage,
  asyncHandler(adminController.deleteUploadedImage),
);

module.exports = router;
