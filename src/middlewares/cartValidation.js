const AppError = require("../utils/AppError");

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_QUANTITY = 999;

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

// Quantity must be an integer >= 1 (and within a sane upper bound). Values are
// coerced onto req.body so downstream code always sees a real integer.
const validateQuantity = (body, errors, { required = true } = {}) => {
  if (body.quantity === undefined || body.quantity === null || body.quantity === "") {
    if (required) {
      errors.push("Quantity is required");
    }
    return;
  }

  const quantity = Number(body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push("Quantity must be an integer greater than or equal to 1");
    return;
  }

  if (quantity > MAX_QUANTITY) {
    errors.push(`Quantity must be at most ${MAX_QUANTITY}`);
    return;
  }

  body.quantity = quantity;
};

const validateAddItem = (req, res, next) => {
  const errors = [];

  if (!req.body.productId || !uuidRegex.test(String(req.body.productId))) {
    errors.push("Valid productId is required");
  }

  if (req.body.variantId !== undefined && req.body.variantId !== null && req.body.variantId !== "") {
    if (!uuidRegex.test(String(req.body.variantId))) {
      errors.push("variantId must be a valid id");
    }
  } else {
    req.body.variantId = null;
  }

  validateQuantity(req.body, errors, { required: true });

  return sendFirstError(errors, next);
};

const validateUpdateItem = (req, res, next) => {
  const errors = [];

  validateQuantity(req.body, errors, { required: true });

  return sendFirstError(errors, next);
};

module.exports = {
  validateAddItem,
  validateUpdateItem,
};
