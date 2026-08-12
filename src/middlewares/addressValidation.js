const AppError = require("../utils/AppError");

// Field-spec validator mirroring authValidation: trims strings, enforces
// required + maxLength, and writes the normalized values back onto req.body so
// the service/repository receive already-clean data (no inline .trim() needed).
function validate(fields, req, res, next) {
  const errors = [];

  fields.forEach((field) => {
    const value = req.body[field.name];

    if (field.required && (value === undefined || value === null || String(value).trim() === "")) {
      errors.push(`${field.label} is required`);
      return;
    }

    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value === "string" && field.trim !== false) {
      req.body[field.name] = value.trim();
    }

    const normalizedValue = req.body[field.name];

    if (typeof normalizedValue !== "string") {
      errors.push(`${field.label} must be a string`);
      return;
    }

    if (field.maxLength && normalizedValue.length > field.maxLength) {
      errors.push(`${field.label} must be at most ${field.maxLength} characters`);
    }
  });

  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
}

const validateCreateAddress = (req, res, next) => {
  return validate(
    [
      { name: "receiverName", label: "Receiver name", required: true, maxLength: 150 },
      { name: "receiverPhone", label: "Receiver phone", required: true, maxLength: 20 },
      { name: "province", label: "Province", required: true, maxLength: 100 },
      { name: "district", label: "District", required: true, maxLength: 100 },
      { name: "ward", label: "Ward", required: true, maxLength: 100 },
      { name: "addressLine", label: "Address line", required: true, maxLength: 255 },
      { name: "postalCode", label: "Postal code", required: false, maxLength: 20 },
    ],
    req,
    res,
    next,
  );
};

module.exports = {
  validateCreateAddress,
};
