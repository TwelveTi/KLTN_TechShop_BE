const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/roleMiddleware");
const adminUploadRoute = require("./adminUploadRoute");
const adminRevenueRoute = require("./adminRevenueRoute");
const adminUserRoute = require("./adminUserRoute");
const adminCategoryRoute = require("./adminCategoryRoute");
const adminBrandRoute = require("./adminBrandRoute");
const adminProductRoute = require("./adminProductRoute");

router.use(authMiddleware);
router.use(checkRole(["ADMIN"]));

router.use(adminUploadRoute);
router.use(adminRevenueRoute);
router.use(adminUserRoute);
router.use(adminCategoryRoute);
router.use(adminBrandRoute);
router.use(adminProductRoute);

module.exports = router;
