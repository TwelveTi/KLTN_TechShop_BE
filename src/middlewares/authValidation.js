const AppError = require("../utils/AppError");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields, req, res, next) {
  const errors = [];

  fields.forEach((field) => {
    const value = req.body[field.name];

    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label} is required`);
      return;
    }

    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value === "string" && field.trim !== false) {
      req.body[field.name] = value.trim();
    }

    if (field.type === "email") {
      req.body[field.name] = String(req.body[field.name]).toLowerCase();
    }

    const normalizedValue = req.body[field.name];

    if (field.type === "email" && !emailRegex.test(String(normalizedValue))) {
      errors.push(`${field.label} must be a valid email`);
    }

    if (field.type === "string" && typeof normalizedValue !== "string") {
      errors.push(`${field.label} must be a string`);
    }

    if (field.minLength && String(normalizedValue).length < field.minLength) {
      errors.push(`${field.label} must be at least ${field.minLength} characters`);
    }

    if (field.maxLength && String(normalizedValue).length > field.maxLength) {
      errors.push(`${field.label} must be at most ${field.maxLength} characters`);
    }
  });

  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
}

const validateRegister = (req, res, next) => {
  return validate(
    [
      { name: "email", label: "Email", required: true, type: "email", maxLength: 255 },
      { name: "password", label: "Password", required: true, type: "string", minLength: 6, maxLength: 72 },
      { name: "fullName", label: "Full name", required: true, type: "string", minLength: 2, maxLength: 150 },
      { name: "phone", label: "Phone", required: false, type: "string", maxLength: 20 },
    ],
    req,
    res,
    next,
  );
};

const validateLogin = (req, res, next) => {
  return validate(
    [
      { name: "email", label: "Email", required: true, type: "email", maxLength: 255 },
      { name: "password", label: "Password", required: true, type: "string", minLength: 6, maxLength: 72 },
    ],
    req,
    res,
    next,
  );
};

const validateLogout = (req, res, next) => {
  return next();
};

const validateUpdateProfile = (req, res, next) => {
  return validate(
    [
      { name: "fullName", label: "Full name", required: false, type: "string", minLength: 2, maxLength: 150 },
      { name: "phone", label: "Phone", required: false, type: "string", maxLength: 20 },
      { name: "avatarUrl", label: "Avatar URL", required: false, type: "string", maxLength: 1000 },
    ],
    req,
    res,
    next,
  );
};

module.exports = {
  validateRegister,
  validateLogin,
  validateLogout,
  validateUpdateProfile,
};
