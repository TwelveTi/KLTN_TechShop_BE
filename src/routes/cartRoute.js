const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const { validateAddItem, validateUpdateItem } = require("../middlewares/cartValidation");
const asyncHandler = require("../utils/asyncHandler");

// All cart routes are scoped to the authenticated user; a user can only ever
// touch their own cart (resolved from req.user.id, never from the request body).
router.get("/cart", authMiddleware, asyncHandler(cartController.getMyCart));
router.post("/cart/items", authMiddleware, validateAddItem, asyncHandler(cartController.addItem));
router.patch(
  "/cart/items/:itemId",
  authMiddleware,
  validateIdParam("itemId"),
  validateUpdateItem,
  asyncHandler(cartController.updateItem),
);
router.delete(
  "/cart/items/:itemId",
  authMiddleware,
  validateIdParam("itemId"),
  asyncHandler(cartController.removeItem),
);
router.delete("/cart", authMiddleware, asyncHandler(cartController.clearCart));

module.exports = router;
