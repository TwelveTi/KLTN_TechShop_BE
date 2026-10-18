const AppError = require("../utils/AppError");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Số Việt Nam: 0 hoặc +84, rồi 9–10 chữ số (giữ cả số 11 chữ số cũ).
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/;
// Mật khẩu mới: ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số. Khớp danh sách tick ở
// trang đăng ký. Đăng nhập không áp luật này để tài khoản cũ vẫn vào được.
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include upper case, lower case and a digit";

const PHONE_FIELD = {
  name: "phone",
  label: "Phone",
  required: false,
  type: "string",
  maxLength: 20,
  pattern: PHONE_PATTERN,
  patternMessage: "Phone must be a Vietnamese number, e.g. 0912345678",
};

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

    if (field.pattern && !field.pattern.test(String(normalizedValue))) {
      errors.push(field.patternMessage || `${field.label} is invalid`);
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
      {
        name: "password",
        label: "Password",
        required: true,
        type: "string",
        maxLength: 72,
        pattern: STRONG_PASSWORD_PATTERN,
        patternMessage: STRONG_PASSWORD_MESSAGE,
      },
      { name: "fullName", label: "Full name", required: true, type: "string", minLength: 2, maxLength: 150 },
      PHONE_FIELD,
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
      PHONE_FIELD,
      { name: "avatarUrl", label: "Avatar URL", required: false, type: "string", maxLength: 1000 },
    ],
    req,
    res,
    next,
  );
};

// Password policy is reused verbatim from register/login (min 6, max 72) so
// reset/change never diverge from the sign-up rules.
const PASSWORD_FIELD = (name, label) => ({
  name,
  label,
  required: true,
  type: "string",
  minLength: 6,
  maxLength: 72,
});

// Mật khẩu đặt mới (đặt lại, đổi mật khẩu) theo cùng luật với lúc đăng ký.
const NEW_PASSWORD_FIELD = (name, label) => ({
  ...PASSWORD_FIELD(name, label),
  pattern: STRONG_PASSWORD_PATTERN,
  patternMessage: STRONG_PASSWORD_MESSAGE,
});

const OTP_PATTERN = /^\d{6}$/;

const validateForgotPassword = (req, res, next) => {
  return validate(
    [{ name: "email", label: "Email", required: true, type: "email", maxLength: 255 }],
    req,
    res,
    next,
  );
};

const validateVerifyResetOtp = (req, res, next) => {
  return validate(
    [
      { name: "email", label: "Email", required: true, type: "email", maxLength: 255 },
      {
        name: "otp",
        label: "OTP",
        required: true,
        type: "string",
        pattern: OTP_PATTERN,
        patternMessage: "OTP must be a 6-digit code",
      },
    ],
    req,
    res,
    next,
  );
};

const validateResetPassword = (req, res, next) => {
  return validate(
    [
      { name: "resetToken", label: "Reset token", required: true, type: "string", maxLength: 255 },
      NEW_PASSWORD_FIELD("newPassword", "New password"),
    ],
    req,
    res,
    next,
  );
};

const validateChangePassword = (req, res, next) => {
  return validate(
    [
      PASSWORD_FIELD("currentPassword", "Current password"),
      NEW_PASSWORD_FIELD("newPassword", "New password"),
    ],
    req,
    res,
    next,
  );
};

module.exports = {
  PHONE_PATTERN,
  validateRegister,
  validateLogin,
  validateLogout,
  validateUpdateProfile,
  validateForgotPassword,
  validateVerifyResetOtp,
  validateResetPassword,
  validateChangePassword,
};
