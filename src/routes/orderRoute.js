const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authMiddleware, requireVerifiedEmail } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const {
  validateCreateOrder,
  validateIdempotencyKey,
  validateCancelOrder,
} = require("../middlewares/orderValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/orders/me", authMiddleware, asyncHandler(orderController.getMyOrders));

// Placing an order reserves stock and can lead to a real payment, so it is
// gated on a verified email like the rest of the money-touching flow.
router.post(
  "/orders",
  authMiddleware,
  requireVerifiedEmail,
  validateIdempotencyKey,
  validateCreateOrder,
  asyncHandler(orderController.createOrder),
);

router.patch(
  "/orders/:id/cancel",
  authMiddleware,
  validateIdParam(),
  validateCancelOrder,
  asyncHandler(orderController.cancelMyOrder),
);

module.exports = router;
