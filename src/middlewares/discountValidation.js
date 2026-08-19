const AppError = require("../utils/AppError");

const DISCOUNT_TYPES = ["PERCENT", "FIXED"];
const DISCOUNT_STATUSES = ["ACTIVE", "PAUSED", "EXPIRED"];

const MAX_CODE_LENGTH = 50;
const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

const normalize = (value) => (typeof value === "string" ? value.trim() : value);

// Codes are stored uppercase, so a shopper typing "sale10" matches "SALE10".
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

const validateApplyDiscount = (req, res, next) => {
  const errors = [];

  req.body.code = String(normalize(req.body.code) || "").toUpperCase();

  if (!req.body.code) {
    errors.push("Discount code is required");
  } else if (req.body.code.length > MAX_CODE_LENGTH || !CODE_PATTERN.test(req.body.code)) {
    errors.push("Discount code format is invalid");
  }

  const subtotal = Number(req.body.subtotal);

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    errors.push("A positive subtotal is required");
  } else {
    req.body.subtotal = subtotal;
  }

  return sendFirstError(errors, next);
};

const validateMoney = (body, field, label, errors, { required = false } = {}) => {
  if (body[field] === undefined || body[field] === null || body[field] === "") {
    if (required) {
      errors.push(`${label} is required`);
    }
    return;
  }

  const amount = Number(body[field]);

  if (!Number.isFinite(amount) || amount < 0) {
    errors.push(`${label} must be a number greater than or equal to 0`);
    return;
  }

  body[field] = amount;
};

const validateNullableInteger = (body, field, label, errors) => {
  if (body[field] === undefined) {
    return;
  }

  if (body[field] === null || body[field] === "") {
    body[field] = null;
    return;
  }

  const parsed = Number(body[field]);

  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${label} must be an integer greater than or equal to 0, or null for unlimited`);
    return;
  }

  body[field] = parsed;
};

const validateDate = (body, field, label, errors, { required = false } = {}) => {
  if (body[field] === undefined || body[field] === null || body[field] === "") {
    if (required) {
      errors.push(`${label} is required`);
    }
    return;
  }

  const date = new Date(body[field]);

  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} must be a valid date`);
    return;
  }

  body[field] = date;
};

const validateDiscount =
  ({ isCreate }) =>
  (req, res, next) => {
    const errors = [];

    if (isCreate || req.body.code !== undefined) {
      req.body.code = String(normalize(req.body.code) || "").toUpperCase();

      if (!req.body.code) {
        errors.push("Code is required");
      } else if (req.body.code.length > MAX_CODE_LENGTH || !CODE_PATTERN.test(req.body.code)) {
        errors.push("Code may only contain A-Z, 0-9, hyphen and underscore");
      }
    }

    if (isCreate || req.body.name !== undefined) {
      req.body.name = normalize(req.body.name);

      if (!req.body.name) {
        errors.push("Name is required");
      } else if (String(req.body.name).length > MAX_NAME_LENGTH) {
        errors.push(`Name must be at most ${MAX_NAME_LENGTH} characters`);
      }
    }

    if (req.body.description !== undefined && req.body.description !== null) {
      req.body.description = normalize(req.body.description);

      if (String(req.body.description).length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
      }
    }

    if (isCreate || req.body.discountType !== undefined) {
      if (!DISCOUNT_TYPES.includes(req.body.discountType)) {
        errors.push(`discountType must be one of: ${DISCOUNT_TYPES.join(", ")}`);
      }
    }

    validateMoney(req.body, "value", "Value", errors, { required: isCreate });
    validateMoney(req.body, "maxDiscountAmount", "maxDiscountAmount", errors);
    validateMoney(req.body, "minOrderValue", "minOrderValue", errors);

    validateNullableInteger(req.body, "usageLimit", "usageLimit", errors);
    validateNullableInteger(req.body, "usageLimitPerUser", "usageLimitPerUser", errors);

    validateDate(req.body, "startsAt", "startsAt", errors, { required: isCreate });
    validateDate(req.body, "endsAt", "endsAt", errors, { required: isCreate });

    if (req.body.status !== undefined && !DISCOUNT_STATUSES.includes(req.body.status)) {
      errors.push(`status must be one of: ${DISCOUNT_STATUSES.join(", ")}`);
    }

    return sendFirstError(errors, next);
  };

module.exports = {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  validateApplyDiscount,
  validateDiscount,
};
