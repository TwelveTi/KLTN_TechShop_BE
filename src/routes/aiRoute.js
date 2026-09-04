const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const aiController = require("../controllers/aiController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { attachSessionId } = require("../middlewares/behaviorValidation");
const { validateAskAdvisor } = require("../middlewares/aiValidation");
const asyncHandler = require("../utils/asyncHandler");

// Unlike every other route in this app, each call here spends money on a
// third-party API. A loop in a client — or one impatient tester holding down
// enter — is a real bill, so the advisor is the one endpoint that throttles.
const advisorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "Too many questions, please wait a moment" },
});

// Optional auth on purpose: a visitor should be able to ask what fits their
// budget before creating an account. Signed in, the thread is theirs by user
// id; as a guest, by the same session key the behaviour tracker issues.
router.post(
  "/ai/advisor",
  advisorLimiter,
  optionalAuth,
  attachSessionId,
  validateAskAdvisor,
  asyncHandler(aiController.askAdvisor),
);

module.exports = router;
