const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { validateIdParam, validateSpecificationDefinition } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

// The per-category "schema" of technical specifications. Managing these
// explicitly is what lets an admin reuse an existing field instead of typing a
// near-duplicate name, which would create a second definition for the same
// thing and quietly break both filtering and AI comparison.
router.get(
  "/admin/categories/:categoryId/specifications",
  validateIdParam("categoryId"),
  asyncHandler(productController.getSpecificationDefinitions),
);

router.post(
  "/admin/categories/:categoryId/specifications",
  validateIdParam("categoryId"),
  validateSpecificationDefinition({ isCreate: true }),
  asyncHandler(productController.createSpecificationDefinition),
);

// Changing `dataType` re-parses every stored value of this definition, and the
// whole request is refused if any of them cannot be converted.
router.put(
  "/admin/specifications/:id",
  validateIdParam(),
  validateSpecificationDefinition({ isCreate: false }),
  asyncHandler(productController.updateSpecificationDefinition),
);

router.delete(
  "/admin/specifications/:id",
  validateIdParam(),
  asyncHandler(productController.deleteSpecificationDefinition),
);

module.exports = router;
