const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { validateIdParam, validateUpdateOrderStatus } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

// Admin order management. Auth + ADMIN role are enforced centrally in adminRoute.
router.get("/admin/orders", asyncHandler(adminController.getAllOrders));
router.get("/admin/orders/:id", validateIdParam(), asyncHandler(adminController.getOrderById));
router.patch(
  "/admin/orders/:id/status",
  validateIdParam(),
  validateUpdateOrderStatus,
  asyncHandler(adminController.updateOrderStatus),
);

module.exports = router;
