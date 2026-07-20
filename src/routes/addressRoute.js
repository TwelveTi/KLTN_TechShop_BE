const express = require("express");
const router = express.Router();
const addressController = require("../controllers/addressController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

router.get("/addresses/me", authMiddleware, asyncHandler(addressController.getMyAddresses));
router.post("/addresses/me", authMiddleware, asyncHandler(addressController.createMyAddress));
router.put("/addresses/me/:id/default", authMiddleware, asyncHandler(addressController.setDefaultAddress));
router.delete("/addresses/me/:id", authMiddleware, asyncHandler(addressController.deleteMyAddress));

module.exports = router;
