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

// Same optional identity as the rail above — not to gate the response (a guest
// sees the same neighbours) but so a click on this rail can be attributed to
// whoever made it.
router.get(
  "/recommendations/products/:id/similar",
  validateIdParam(),
  optionalAuth,
  attachSessionId,
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
