const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateCreateVnpayUrl } = require("../middlewares/paymentValidation");
const asyncHandler = require("../utils/asyncHandler");

router.post(
  "/payments/vnpay/create-url",
  authMiddleware,
  validateCreateVnpayUrl,
  asyncHandler(paymentController.createVnpayUrl),
);

// Both callbacks are unauthenticated by necessity — one is a browser redirect
// coming back from the gateway, the other is VNPay's server calling ours. The
// HMAC signature on the query string is what authenticates them.
router.get("/payments/vnpay/return", asyncHandler(paymentController.vnpayReturn));
router.get("/payments/vnpay/ipn", asyncHandler(paymentController.vnpayIpn));

module.exports = router;
