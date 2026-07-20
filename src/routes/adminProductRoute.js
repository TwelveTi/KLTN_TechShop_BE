const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const {
  validateIdParam,
  validateProduct,
  validateUpdateProduct,
} = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/products", asyncHandler(productController.getAllProductsForAdmin));
router.get("/admin/products/:id", validateIdParam(), asyncHandler(productController.getProductByIdForAdmin));
router.post("/admin/products", validateProduct, asyncHandler(productController.createProduct));
router.put("/admin/products/:id", validateIdParam(), validateUpdateProduct, asyncHandler(productController.updateProduct));
router.delete("/admin/products/:id", validateIdParam(), asyncHandler(productController.deleteProduct));

module.exports = router;
