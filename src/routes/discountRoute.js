const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateApplyDiscount } = require("../middlewares/discountValidation");
const asyncHandler = require("../utils/asyncHandler");

// Preview only. Authenticated because per-user redemption limits are part of
// the answer, and because an open endpoint would let anyone enumerate codes.
router.post(
  "/discounts/validate",
  authMiddleware,
  validateApplyDiscount,
  asyncHandler(discountController.validateCode),
);

module.exports = router;
