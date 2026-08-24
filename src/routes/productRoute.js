const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { validateIdParam } = require("../middlewares/adminValidation");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { attachSessionId } = require("../middlewares/behaviorValidation");
const asyncHandler = require("../utils/asyncHandler");

// Public routes: guests can view products without a token. `optionalAuth` +
// `attachSessionId` only resolve who is looking, so searches and product views
// can be recorded for recommendations — signed in or not. Neither can fail the
// request.
router.get("/products", optionalAuth, attachSessionId, asyncHandler(productController.getAllProducts));
router.get(
  "/products/:id",
  validateIdParam(),
  optionalAuth,
  attachSessionId,
  asyncHandler(productController.getProductById),
);

module.exports = router;
