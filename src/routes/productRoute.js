const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { validateIdParam } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

// Public routes: guests can view products without token.
router.get("/products", asyncHandler(productController.getAllProducts));
router.get("/products/:id", validateIdParam(), asyncHandler(productController.getProductById));

module.exports = router;
