const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateApplyDiscount, validateAvailableDiscounts } = require("../middlewares/discountValidation");
const asyncHandler = require("../utils/asyncHandler");

// Preview only. Authenticated because per-user redemption limits are part of
// the answer, and because an open endpoint would let anyone enumerate codes.
router.post(
  "/discounts/validate",
  authMiddleware,
  validateApplyDiscount,
  asyncHandler(discountController.validateCode),
);

// Mã khách đang dùng được, để chọn ở trang thanh toán. Cần đăng nhập vì phải loại
// những mã khách đã dùng hết lượt của mình.
router.get(
  "/discounts/available",
  authMiddleware,
  validateAvailableDiscounts,
  asyncHandler(discountController.getAvailableDiscounts),
);

module.exports = router;
