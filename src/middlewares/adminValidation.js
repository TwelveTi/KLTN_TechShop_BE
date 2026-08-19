const AppError = require("../utils/AppError");
const { DATA_TYPES: SPEC_DATA_TYPES } = require("../utils/specValue");

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeString = (value) => (typeof value === "string" ? value.trim() : value);

const validateIdParam = (paramName = "id") => {
  return (req, res, next) => {
    if (!uuidRegex.test(req.params[paramName])) {
      return next(new AppError("Invalid id", 400));
    }

    return next();
  };
};

const requireString = (body, field, label, errors, maxLength = 255) => {
  body[field] = normalizeString(body[field]);

  if (!body[field]) {
    errors.push(`${label} is required`);
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push(`${label} must be a string`);
    return;
  }

  if (body[field].length > maxLength) {
    errors.push(`${label} must be at most ${maxLength} characters`);
  }
};

const validateOptionalString = (body, field, label, errors, maxLength = 255) => {
  body[field] = normalizeString(body[field]);

  if (body[field] === undefined || body[field] === null || body[field] === "") {
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push(`${label} must be a string`);
    return;
  }

  if (body[field].length > maxLength) {
    errors.push(`${label} must be at most ${maxLength} characters`);
  }
};

const validateOptionalEnum = (body, field, label, values, errors) => {
  if (body[field] !== undefined && !values.includes(body[field])) {
    errors.push(`${label} is invalid`);
  }
};

const validateOptionalUuid = (body, field, label, errors) => {
  if (body[field] !== undefined && body[field] !== null && !uuidRegex.test(body[field])) {
    errors.push(`${label} must be a valid id`);
  }
};

const validatePositiveNumber = (body, field, label, errors, required = false) => {
  if (required && (body[field] === undefined || body[field] === null || body[field] === "")) {
    errors.push(`${label} is required`);
    return;
  }

  if (body[field] === undefined || body[field] === null || body[field] === "") {
    return;
  }

  const numberValue = Number(body[field]);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    errors.push(`${label} must be a positive number`);
    return;
  }

  body[field] = numberValue;
};

const validateInteger = (body, field, label, errors, required = false) => {
  if (required && (body[field] === undefined || body[field] === null || body[field] === "")) {
    errors.push(`${label} is required`);
    return;
  }

  if (body[field] === undefined || body[field] === null || body[field] === "") {
    return;
  }

  const numberValue = Number(body[field]);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    errors.push(`${label} must be a positive integer`);
    return;
  }

  body[field] = numberValue;
};

const validateImages = (images, errors, required = false) => {
  if (required && (!Array.isArray(images) || images.length === 0)) {
    errors.push("At least one uploaded product image is required");
    return;
  }

  if (images === undefined) {
    return;
  }

  if (!Array.isArray(images)) {
    errors.push("Images must be an array");
    return;
  }

  images.forEach((image, index) => {
    if (!image || typeof image !== "object") {
      errors.push(`Image ${index + 1} is invalid`);
      return;
    }

    image.imageUrl = normalizeString(image.imageUrl);
    image.publicId = normalizeString(image.publicId);
    image.status = normalizeString(image.status);

    if (image.status && image.status !== "UPLOADED") {
      errors.push(`Image ${index + 1} is still uploading`);
    }

    if (!image.imageUrl) {
      errors.push(`Image ${index + 1} url is required`);
    }

    if (!image.publicId) {
      errors.push(`Image ${index + 1} public id is required`);
    }
  });
};

const validateVariants = (variants, errors) => {
  if (variants === undefined) {
    return;
  }

  if (!Array.isArray(variants)) {
    errors.push("Variants must be an array");
    return;
  }

  variants.forEach((variant, index) => {
    if (!variant || typeof variant !== "object") {
      errors.push(`Variant ${index + 1} is invalid`);
      return;
    }

    variant.sku = normalizeString(variant.sku);
    variant.variantName = normalizeString(variant.variantName);

    if (!variant.sku) {
      errors.push(`Variant ${index + 1} sku is required`);
    }

    if (!variant.variantName) {
      errors.push(`Variant ${index + 1} name is required`);
    }
  });
};

const validateSpecifications = (specifications, errors) => {
  if (specifications === undefined) {
    return;
  }

  if (!Array.isArray(specifications)) {
    errors.push("Specifications must be an array");
    return;
  }

  specifications.forEach((specification, index) => {
    if (!specification || typeof specification !== "object") {
      errors.push(`Specification ${index + 1} is invalid`);
      return;
    }

    specification.name = normalizeString(specification.name);

    // `valueText` is what the existing admin form sends; `value` is accepted as
    // an alias so a typed client (or the spec import) can post a real number or
    // boolean instead of a string. Only strings get trimmed — coercing a 0 or a
    // false into "" here would drop legitimate values.
    if (specification.value === undefined && specification.valueText !== undefined) {
      specification.value = specification.valueText;
    }

    if (typeof specification.value === "string") {
      specification.value = specification.value.trim();
    }

    if (!specification.name) {
      errors.push(`Specification ${index + 1} name is required`);
    }

    if (specification.value === undefined || specification.value === null || specification.value === "") {
      errors.push(`Specification ${index + 1} value is required`);
    }

    if (specification.dataType !== undefined && !SPEC_DATA_TYPES.includes(specification.dataType)) {
      errors.push(`Specification ${index + 1} dataType must be one of: ${SPEC_DATA_TYPES.join(", ")}`);
    }

    if (specification.definitionId !== undefined && specification.definitionId !== null) {
      if (!uuidRegex.test(String(specification.definitionId))) {
        errors.push(`Specification ${index + 1} definitionId must be a valid id`);
      }
    }
  });
};

// Admin CRUD on a category's specification definitions. `isCreate` makes name
// and dataType mandatory; an update may send any subset.
const validateSpecificationDefinition =
  ({ isCreate }) =>
  (req, res, next) => {
    const errors = [];

    if (isCreate || req.body.name !== undefined) {
      requireString(req.body, "name", "Specification name", errors, 150);
    }

    if (req.body.key !== undefined) {
      validateOptionalString(req.body, "key", "Specification key", errors, 100);
    }

    if (req.body.dataType !== undefined) {
      if (!SPEC_DATA_TYPES.includes(req.body.dataType)) {
        errors.push(`dataType must be one of: ${SPEC_DATA_TYPES.join(", ")}`);
      }
    } else if (isCreate) {
      req.body.dataType = "STRING";
    }

    validateOptionalString(req.body, "unit", "Unit", errors, 50);

    ["isFilterable", "isComparable"].forEach((field) => {
      if (req.body[field] !== undefined && typeof req.body[field] !== "boolean") {
        errors.push(`${field} must be true or false`);
      }
    });

    if (req.body.sortOrder !== undefined) {
      const sortOrder = Number(req.body.sortOrder);

      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        errors.push("sortOrder must be an integer greater than or equal to 0");
      } else {
        req.body.sortOrder = sortOrder;
      }
    }

    return sendFirstError(errors, next);
  };

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

const validateRevenueQuery = (req, res, next) => {
  const errors = [];
  const { startDate, endDate, year, limit } = req.query;

  if (startDate && Number.isNaN(Date.parse(startDate))) {
    errors.push("Start date is invalid");
  }

  if (endDate && Number.isNaN(Date.parse(endDate))) {
    errors.push("End date is invalid");
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push("Start date must be before end date");
  }

  if (year !== undefined) {
    const yearValue = Number(year);
    if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2100) {
      errors.push("Year is invalid");
    }
  }

  if (limit !== undefined) {
    const limitValue = Number(limit);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) {
      errors.push("Limit must be between 1 and 50");
    }
  }

  return sendFirstError(errors, next);
};

const validateCreateUser = (req, res, next) => {
  const errors = [];

  req.body.email = normalizeString(req.body.email)?.toLowerCase();
  requireString(req.body, "email", "Email", errors, 255);

  if (req.body.email && !emailRegex.test(req.body.email)) {
    errors.push("Email must be a valid email");
  }

  requireString(req.body, "password", "Password", errors, 72);
  requireString(req.body, "fullName", "Full name", errors, 150);

  if (req.body.password && req.body.password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  validateOptionalEnum(req.body, "role", "Role", ["CUSTOMER", "ADMIN"], errors);
  validateOptionalEnum(req.body, "status", "Status", ["ACTIVE", "INACTIVE", "BLOCKED"], errors);

  return sendFirstError(errors, next);
};

const validateUpdateUser = (req, res, next) => {
  const errors = [];

  if (req.body.email !== undefined) {
    req.body.email = normalizeString(req.body.email)?.toLowerCase();
    if (!emailRegex.test(req.body.email)) {
      errors.push("Email must be a valid email");
    }
  }

  if (req.body.fullName !== undefined) {
    req.body.fullName = normalizeString(req.body.fullName);
    if (!req.body.fullName) {
      errors.push("Full name cannot be empty");
    }
  }

  validateOptionalEnum(req.body, "role", "Role", ["CUSTOMER", "ADMIN"], errors);
  validateOptionalEnum(req.body, "status", "Status", ["ACTIVE", "INACTIVE", "BLOCKED"], errors);

  return sendFirstError(errors, next);
};

const validateCategory = (req, res, next) => {
  const errors = [];

  requireString(req.body, "name", "Category name", errors, 150);

  if (req.body.slug !== undefined) {
    requireString(req.body, "slug", "Category slug", errors, 180);
  }

  validateOptionalUuid(req.body, "parentId", "Parent category", errors);

  return sendFirstError(errors, next);
};

const validateBrand = (req, res, next) => {
  const errors = [];

  requireString(req.body, "name", "Brand name", errors, 150);

  if (req.body.slug !== undefined) {
    requireString(req.body, "slug", "Brand slug", errors, 180);
  }

  return sendFirstError(errors, next);
};

const validateProduct = (req, res, next) => {
  const errors = [];

  validateOptionalUuid(req.body, "categoryId", "Category", errors);
  validateOptionalUuid(req.body, "brandId", "Brand", errors);
  requireString(req.body, "name", "Product name", errors, 255);

  if (req.body.slug !== undefined) {
    requireString(req.body, "slug", "Product slug", errors, 280);
  }

  validateOptionalString(req.body, "shortDescription", "Short description", errors, 500);
  validateOptionalString(req.body, "description", "Description", errors, 20000);

  validatePositiveNumber(req.body, "basePrice", "Base price", errors, true);
  validatePositiveNumber(req.body, "salePrice", "Sale price", errors);
  validateInteger(req.body, "stockQuantity", "Stock quantity", errors);
  validateOptionalEnum(req.body, "status", "Status", ["DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"], errors);

  if (!req.body.categoryId) {
    errors.push("Category is required");
  }

  if (!req.body.brandId) {
    errors.push("Brand is required");
  }

  validateImages(req.body.images, errors);
  validateVariants(req.body.variants, errors);
  validateSpecifications(req.body.specifications, errors);

  return sendFirstError(errors, next);
};

const validateUpdateProduct = (req, res, next) => {
  const errors = [];

  validateOptionalUuid(req.body, "categoryId", "Category", errors);
  validateOptionalUuid(req.body, "brandId", "Brand", errors);
  validatePositiveNumber(req.body, "basePrice", "Base price", errors);
  validatePositiveNumber(req.body, "salePrice", "Sale price", errors);
  validateInteger(req.body, "stockQuantity", "Stock quantity", errors);
  validateOptionalEnum(req.body, "status", "Status", ["DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"], errors);

  if (req.body.name !== undefined) {
    requireString(req.body, "name", "Product name", errors, 255);
  }

  if (req.body.slug !== undefined) {
    requireString(req.body, "slug", "Product slug", errors, 280);
  }

  validateOptionalString(req.body, "shortDescription", "Short description", errors, 500);
  validateOptionalString(req.body, "description", "Description", errors, 20000);

  validateImages(req.body.images, errors);
  validateVariants(req.body.variants, errors);
  validateSpecifications(req.body.specifications, errors);

  return sendFirstError(errors, next);
};

const validateDeleteUploadedImage = (req, res, next) => {
  req.body.publicId = normalizeString(req.body.publicId);

  if (!req.body.publicId) {
    return next(new AppError("Public id is required", 400));
  }

  return next();
};

const ORDER_STATUS_VALUES = ["PENDING", "PAID", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"];

const validateUpdateOrderStatus = (req, res, next) => {
  const errors = [];

  if (!req.body.status) {
    errors.push("Status is required");
  } else if (!ORDER_STATUS_VALUES.includes(req.body.status)) {
    errors.push(`Status must be one of: ${ORDER_STATUS_VALUES.join(", ")}`);
  }

  validateOptionalString(req.body, "note", "Note", errors, 1000);

  return sendFirstError(errors, next);
};

module.exports = {
  validateIdParam,
  validateCreateUser,
  validateUpdateUser,
  validateCategory,
  validateBrand,
  validateProduct,
  validateUpdateProduct,
  validateSpecificationDefinition,
  validateDeleteUploadedImage,
  validateRevenueQuery,
  validateUpdateOrderStatus,
};
