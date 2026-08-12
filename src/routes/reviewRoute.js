const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const { validateCreateReview, validateUpdateReview } = require("../middlewares/reviewValidation");
const asyncHandler = require("../utils/asyncHandler");

// Public: anyone can read a product's reviews and rating summary.
router.get(
  "/products/:productId/reviews",
  validateIdParam("productId"),
  asyncHandler(reviewController.getProductReviews),
);
router.get(
  "/products/:productId/reviews/summary",
  validateIdParam("productId"),
  asyncHandler(reviewController.getProductReviewSummary),
);

// Authenticated: create a review. userId comes from the auth context and
// productId from the route param — never from the request body.
router.post(
  "/products/:productId/reviews",
  authMiddleware,
  validateIdParam("productId"),
  validateCreateReview,
  asyncHandler(reviewController.createReview),
);

// Authenticated: users may only modify/delete their own review.
router.patch(
  "/reviews/:reviewId",
  authMiddleware,
  validateIdParam("reviewId"),
  validateUpdateReview,
  asyncHandler(reviewController.updateReview),
);
router.delete(
  "/reviews/:reviewId",
  authMiddleware,
  validateIdParam("reviewId"),
  asyncHandler(reviewController.deleteReview),
);

module.exports = router;
