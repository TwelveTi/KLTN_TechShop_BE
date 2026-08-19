const express = require("express");
const router = express.Router();
const catalogController = require("../controllers/catalogController");
const { validateSlugParam } = require("../middlewares/catalogValidation");
const asyncHandler = require("../utils/asyncHandler");

// Public taxonomy. Only active rows are exposed, and every entry carries a
// productCount so the storefront no longer has to derive the taxonomy by
// scanning `/products?limit=100`.
router.get("/categories", asyncHandler(catalogController.getCategories));
router.get("/categories/:slug", validateSlugParam(), asyncHandler(catalogController.getCategoryBySlug));

router.get("/brands", asyncHandler(catalogController.getBrands));
router.get("/brands/:slug", validateSlugParam(), asyncHandler(catalogController.getBrandBySlug));

module.exports = router;
