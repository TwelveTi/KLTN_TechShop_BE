const AppError = require("../utils/AppError");

const STRATEGIES = [
  "userPreference",
  "searchHistory",
  "purchaseHistory",
  "productSimilarity",
  "popularity",
];

const OUTCOMES = ["CLICK", "ADD_TO_CART", "PURCHASE"];

const MAX_LIMIT = 50;

const validateRecommendationQuery = (req, res, next) => {
  const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return next(new AppError(`limit must be an integer between 1 and ${MAX_LIMIT}`, 400));
  }

  req.query.limit = limit;

  // `strategy` forces a single scoring component instead of the hybrid. It exists
  // for the evaluation chapter (compare one algorithm against the blend), which
  // is why it is validated against the real component names rather than ignored.
  if (req.query.strategy !== undefined && req.query.strategy !== "") {
    if (!STRATEGIES.includes(req.query.strategy)) {
      return next(new AppError(`strategy must be one of: ${STRATEGIES.join(", ")}`, 400));
    }
  } else {
    req.query.strategy = null;
  }

  return next();
};

const validateOutcome = (req, res, next) => {
  const outcome = String(req.body.outcome || "").toUpperCase();

  if (!OUTCOMES.includes(outcome)) {
    return next(new AppError(`outcome must be one of: ${OUTCOMES.join(", ")}`, 400));
  }

  req.body.outcome = outcome;

  return next();
};

const validateRebuildSimilarity = (req, res, next) => {
  if (req.body.perProduct !== undefined) {
    const perProduct = Number(req.body.perProduct);
    if (!Number.isInteger(perProduct) || perProduct < 1 || perProduct > 50) {
      return next(new AppError("perProduct must be an integer between 1 and 50", 400));
    }
    req.body.perProduct = perProduct;
  }

  if (req.body.minScore !== undefined) {
    const minScore = Number(req.body.minScore);
    if (!Number.isFinite(minScore) || minScore < 0 || minScore >= 1) {
      return next(new AppError("minScore must be a number between 0 and 1", 400));
    }
    req.body.minScore = minScore;
  }

  return next();
};

module.exports = {
  STRATEGIES,
  OUTCOMES,
  validateRecommendationQuery,
  validateOutcome,
  validateRebuildSimilarity,
};
