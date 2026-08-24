const express = require("express");
const router = express.Router();
const recommendationController = require("../controllers/recommendationController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const { attachSessionId } = require("../middlewares/behaviorValidation");
const {
  validateRecommendationQuery,
  validateOutcome,
} = require("../middlewares/recommendationValidation");
const asyncHandler = require("../utils/asyncHandler");

// Auth is optional throughout: a signed-in shopper gets the hybrid, a guest gets
// the popularity list. A rail that 401s would just be a hole in the page.
router.get(
  "/recommendations",
  optionalAuth,
  attachSessionId,
  validateRecommendationQuery,
  asyncHandler(recommendationController.getForMe),
);

router.get(
  "/recommendations/products/:id/similar",
  validateIdParam(),
  validateRecommendationQuery,
  asyncHandler(recommendationController.getSimilarProducts),
);

router.post(
  "/recommendations/items/:itemId/outcome",
  optionalAuth,
  validateIdParam("itemId"),
  validateOutcome,
  asyncHandler(recommendationController.recordOutcome),
);

module.exports = router;
