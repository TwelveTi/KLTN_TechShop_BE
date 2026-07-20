const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

router.get("/orders/me", authMiddleware, asyncHandler(orderController.getMyOrders));

module.exports = router;
