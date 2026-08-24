const express = require("express");
const router = express.Router();
const behaviorController = require("../controllers/behaviorController");
const { authMiddleware, optionalAuth } = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const { attachSessionId, validateTrackBehavior } = require("../middlewares/behaviorValidation");
const asyncHandler = require("../utils/asyncHandler");

// Client-reported activity. Anonymous visitors are allowed (identified by
// `X-Session-Id`) because most browsing happens before sign-in, and that is
// exactly the browsing recommendations need.
//
// Only events the server cannot observe itself are accepted here — see
// utils/behaviorSignals CLIENT_REPORTABLE_TYPES. Views, searches, cart adds and
// purchases are recorded server-side where they cannot be forged.
router.post(
  "/behaviors",
  optionalAuth,
  attachSessionId,
  validateTrackBehavior,
  asyncHandler(behaviorController.track),
);

// Search history belongs to the shopper: they can read it, and delete it.
router.get("/search-history/me", authMiddleware, asyncHandler(behaviorController.getMySearchHistory));
router.get("/search-history/me/keywords", authMiddleware, asyncHandler(behaviorController.getMyRecentKeywords));
router.delete("/search-history/me", authMiddleware, asyncHandler(behaviorController.clearMySearchHistory));
router.delete(
  "/search-history/me/:id",
  authMiddleware,
  validateIdParam(),
  asyncHandler(behaviorController.deleteMySearchHistoryEntry),
);

// The weighted summary the recommender reads. `?recompute=true` forces a rebuild
// from the event log instead of returning the stored snapshot.
router.get("/me/preferences", authMiddleware, asyncHandler(behaviorController.getMyPreferenceProfile));

module.exports = router;
