const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { validateRevenueQuery } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/admin/revenue/summary", validateRevenueQuery, asyncHandler(adminController.getRevenueSummary));
router.get("/admin/revenue/daily", validateRevenueQuery, asyncHandler(adminController.getDailyRevenue));
router.get("/admin/revenue/monthly", validateRevenueQuery, asyncHandler(adminController.getMonthlyRevenue));
router.get("/admin/revenue/products", validateRevenueQuery, asyncHandler(adminController.getTopProducts));
router.get("/admin/revenue/categories", validateRevenueQuery, asyncHandler(adminController.getRevenueByCategory));
router.get("/admin/revenue/brands", validateRevenueQuery, asyncHandler(adminController.getRevenueByBrand));

module.exports = router;
