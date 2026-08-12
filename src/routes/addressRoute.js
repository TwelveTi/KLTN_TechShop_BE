const express = require("express");
const router = express.Router();
const addressController = require("../controllers/addressController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const { validateCreateAddress } = require("../middlewares/addressValidation");
const asyncHandler = require("../utils/asyncHandler");

router.get("/addresses/me", authMiddleware, asyncHandler(addressController.getMyAddresses));
router.post("/addresses/me", authMiddleware, validateCreateAddress, asyncHandler(addressController.createMyAddress));
router.put("/addresses/me/:id/default", authMiddleware, validateIdParam(), asyncHandler(addressController.setDefaultAddress));
router.delete("/addresses/me/:id", authMiddleware, validateIdParam(), asyncHandler(addressController.deleteMyAddress));

module.exports = router;
