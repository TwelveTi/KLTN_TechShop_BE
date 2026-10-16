const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const {
  validateIdParam,
  validateProduct,
  validateUpdateProduct,
  validateCreateVariant,
  validateUpdateVariant,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/products", asyncHandler(productController.getAllProductsForAdmin));
router.get("/admin/products/:id", validateIdParam(), asyncHandler(productController.getProductByIdForAdmin));
router.post("/admin/products", validateProduct, asyncHandler(productController.createProduct));
router.put("/admin/products/:id", validateIdParam(), validateUpdateProduct, asyncHandler(productController.updateProduct));
router.delete("/admin/products/:id", validateIdParam(), asyncHandler(productController.deleteProduct));

// Biến thể sửa từng cái, giữ nguyên id để giỏ hàng và đơn hàng không mất liên kết.
router.post(
  "/admin/products/:id/variants",
  validateIdParam(),
  validateCreateVariant,
  asyncHandler(productController.createVariant),
);
router.put(
  "/admin/products/:id/variants/:variantId",
  validateIdParam(),
  validateIdParam("variantId"),
  validateUpdateVariant,
  asyncHandler(productController.updateVariant),
);
router.delete(
  "/admin/products/:id/variants/:variantId",
  validateIdParam(),
  validateIdParam("variantId"),
  asyncHandler(productController.deleteVariant),
);

module.exports = router;
