const AppError = require("../utils/AppError");

const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 5000;

const normalizeString = (value) => (typeof value === "string" ? value.trim() : value);

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

// Rating must be an integer between 1 and 5. Coerced onto req.body so the
// service always receives a real integer.
const validateRating = (body, errors, { required = true } = {}) => {
  if (body.rating === undefined || body.rating === null || body.rating === "") {
    if (required) {
      errors.push("Rating is required");
    }
    return;
  }

  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push("Rating must be an integer between 1 and 5");
    return;
  }

  body.rating = rating;
};

const validateTitle = (body, errors) => {
  if (body.title === undefined || body.title === null) {
    return;
  }

  body.title = normalizeString(body.title);

  if (typeof body.title !== "string") {
    errors.push("Title must be a string");
    return;
  }

  if (body.title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be at most ${MAX_TITLE_LENGTH} characters`);
    return;
  }

  // Empty string after trim is treated as "no title".
  if (body.title === "") {
    body.title = null;
  }
};

const validateContent = (body, errors) => {
  if (body.content === undefined || body.content === null) {
    return;
  }

  body.content = normalizeString(body.content);

  if (typeof body.content !== "string") {
    errors.push("Content must be a string");
    return;
  }

  if (body.content.length > MAX_CONTENT_LENGTH) {
    errors.push(`Content must be at most ${MAX_CONTENT_LENGTH} characters`);
    return;
  }

  if (body.content === "") {
    body.content = null;
  }
};

const validateCreateReview = (req, res, next) => {
  const errors = [];

  validateRating(req.body, errors, { required: true });
  validateTitle(req.body, errors);
  validateContent(req.body, errors);

  return sendFirstError(errors, next);
};

const validateUpdateReview = (req, res, next) => {
  const errors = [];

  validateRating(req.body, errors, { required: false });
  validateTitle(req.body, errors);
  validateContent(req.body, errors);

  // Require at least one updatable field to be present.
  if (
    req.body.rating === undefined
    && req.body.title === undefined
    && req.body.content === undefined
  ) {
    errors.push("At least one of rating, title or content is required");
  }

  return sendFirstError(errors, next);
};

module.exports = {
  validateCreateReview,
  validateUpdateReview,
};
