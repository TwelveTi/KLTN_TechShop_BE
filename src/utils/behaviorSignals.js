// The tracked event vocabulary and how much each event says about intent.
//
// Shared by behaviorService (which folds events into a preference profile) and
// behaviorValidation (which guards the client-facing endpoint), so the two can
// never drift apart. Same reasoning as utils/pricing.
//
// BEHAVIOR_TYPES must stay in sync with the ENUM on UserBehavior.behaviorType.
const BEHAVIOR_TYPES = [
  "SEARCH",
  "VIEW_PRODUCT",
  "ADD_TO_CART",
  "PURCHASE",
  "FAVORITE",
  "REVIEW",
  "CLICK_RECOMMENDATION",
];

// Buying something means far more than glancing at it. These weights are the
// one place to tune how the profile reads the event log.
const SIGNAL_WEIGHTS = {
  PURCHASE: 10,
  ADD_TO_CART: 5,
  FAVORITE: 4,
  REVIEW: 3,
  CLICK_RECOMMENDATION: 2,
  VIEW_PRODUCT: 1,
  SEARCH: 1,
};

// Events a client is allowed to report. Everything else the backend observes
// itself, where it cannot be forged by a caller inflating their own signals.
const CLIENT_REPORTABLE_TYPES = ["CLICK_RECOMMENDATION", "FAVORITE"];

module.exports = { BEHAVIOR_TYPES, SIGNAL_WEIGHTS, CLIENT_REPORTABLE_TYPES };
