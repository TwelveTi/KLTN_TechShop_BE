const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");
const { validateIdParam } = require("../middlewares/adminValidation");
const { validateDiscount } = require("../middlewares/discountValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/discounts", asyncHandler(discountController.getAllDiscounts));

router.post(
  "/admin/discounts",
  validateDiscount({ isCreate: true }),
  asyncHandler(discountController.createDiscount),
);

router.put(
  "/admin/discounts/:id",
  validateIdParam(),
  validateDiscount({ isCreate: false }),
  asyncHandler(discountController.updateDiscount),
);

// Only codes that have never been redeemed can be deleted; the rest are paused,
// so past orders keep a readable discount history.
router.delete("/admin/discounts/:id", validateIdParam(), asyncHandler(discountController.deleteDiscount));

module.exports = router;
