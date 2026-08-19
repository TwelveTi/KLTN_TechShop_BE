const AppError = require("../utils/AppError");

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAYMENT_METHODS = ["COD", "VNPAY"];
const MAX_QUANTITY = 999;
const MAX_LINES = 50;
const MAX_NOTE_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 100;
const MAX_DISCOUNT_CODE_LENGTH = 50;
const DISCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

// Normalises one requested line onto a clean object so the service never has to
// re-parse client input.
const validateLine = (raw, index, errors) => {
  const label = `Item ${index + 1}`;

  if (!raw || typeof raw !== "object") {
    errors.push(`${label} is invalid`);
    return null;
  }

  if (!raw.productId || !uuidRegex.test(String(raw.productId))) {
    errors.push(`${label}: valid productId is required`);
    return null;
  }

  let variantId = null;
  if (raw.variantId !== undefined && raw.variantId !== null && raw.variantId !== "") {
    if (!uuidRegex.test(String(raw.variantId))) {
      errors.push(`${label}: variantId must be a valid id`);
      return null;
    }
    variantId = String(raw.variantId);
  }

  const quantity = Number(raw.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push(`${label}: quantity must be an integer greater than or equal to 1`);
    return null;
  }

  if (quantity > MAX_QUANTITY) {
    errors.push(`${label}: quantity must be at most ${MAX_QUANTITY}`);
    return null;
  }

  return { productId: String(raw.productId), variantId, quantity };
};

const validateCreateOrder = (req, res, next) => {
  const errors = [];

  if (!req.body.addressId || !uuidRegex.test(String(req.body.addressId))) {
    errors.push("Valid addressId is required");
  }

  const paymentMethod = String(req.body.paymentMethod || "").toUpperCase();
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push(`paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}`);
  } else {
    req.body.paymentMethod = paymentMethod;
  }

  if (req.body.deliveryMethodId !== undefined && req.body.deliveryMethodId !== null) {
    req.body.deliveryMethodId = String(req.body.deliveryMethodId).trim() || undefined;
  }

  // Optional. Codes are stored uppercase so "sale10" matches "SALE10".
  if (req.body.discountCode !== undefined && req.body.discountCode !== null && req.body.discountCode !== "") {
    const code = String(req.body.discountCode).trim().toUpperCase();

    if (code.length > MAX_DISCOUNT_CODE_LENGTH || !DISCOUNT_CODE_PATTERN.test(code)) {
      errors.push("Discount code format is invalid");
    }

    req.body.discountCode = code;
  } else {
    req.body.discountCode = null;
  }

  if (req.body.note !== undefined && req.body.note !== null && req.body.note !== "") {
    const note = String(req.body.note).trim();
    if (note.length > MAX_NOTE_LENGTH) {
      errors.push(`Note must be at most ${MAX_NOTE_LENGTH} characters`);
    }
    req.body.note = note;
  } else {
    req.body.note = null;
  }

  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    errors.push("At least one item is required");
    return sendFirstError(errors, next);
  }

  if (req.body.items.length > MAX_LINES) {
    errors.push(`An order can contain at most ${MAX_LINES} lines`);
    return sendFirstError(errors, next);
  }

  const items = [];
  req.body.items.forEach((raw, index) => {
    const line = validateLine(raw, index, errors);
    if (line) {
      items.push(line);
    }
  });

  req.body.items = items;

  return sendFirstError(errors, next);
};

// The header is optional — an order still gets created without it — but when
// present it must be short enough for the column that stores it.
const validateIdempotencyKey = (req, res, next) => {
  const raw = req.headers["idempotency-key"];

  if (raw === undefined || raw === null || raw === "") {
    req.idempotencyKey = null;
    return next();
  }

  const key = String(raw).trim();

  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return next(new AppError(`Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`, 400));
  }

  req.idempotencyKey = key;
  return next();
};

const validateCancelOrder = (req, res, next) => {
  if (req.body.reason !== undefined && req.body.reason !== null && req.body.reason !== "") {
    const reason = String(req.body.reason).trim();

    if (reason.length > MAX_NOTE_LENGTH) {
      return next(new AppError(`Reason must be at most ${MAX_NOTE_LENGTH} characters`, 400));
    }

    req.body.reason = reason;
  } else {
    req.body.reason = null;
  }

  return next();
};

module.exports = {
  validateCreateOrder,
  validateIdempotencyKey,
  validateCancelOrder,
};
