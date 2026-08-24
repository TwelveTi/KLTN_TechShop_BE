const express = require("express");
const router = express.Router();
const recommendationController = require("../controllers/recommendationController");
const { validateRebuildSimilarity } = require("../middlewares/recommendationValidation");
const asyncHandler = require("../utils/asyncHandler");

// The O(n^2) content-similarity pass. Batch on purpose — far too slow to run
// inside a request, so it is triggered deliberately (and could later move to a
// cron or a Kafka consumer).
router.post(
  "/admin/recommendations/similarity/rebuild",
  validateRebuildSimilarity,
  asyncHandler(recommendationController.rebuildSimilarity),
);

// Shown / clicked / carted / purchased counters — the raw numbers behind the
// evaluation chapter.
router.get("/admin/recommendations/stats", asyncHandler(recommendationController.getOutcomeStats));

module.exports = router;
