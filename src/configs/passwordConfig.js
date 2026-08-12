// Centralised, env-driven configuration for the password-management flow
// (forgot / verify OTP / reset / change). Kept out of the service so the
// numbers/secrets live in one place and can be tuned without touching logic.
require("dotenv").config();

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  // OTP
  OTP_LENGTH: 6,
  OTP_EXPIRATION_MINUTES: toPositiveInt(process.env.OTP_EXPIRATION_MINUTES, 10),
  MAX_OTP_ATTEMPTS: toPositiveInt(process.env.MAX_OTP_ATTEMPTS, 5),
  OTP_RESEND_COOLDOWN_SECONDS: toPositiveInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),

  // Reset authorization token minted after a successful OTP verification.
  RESET_TOKEN_EXPIRATION_MINUTES: toPositiveInt(process.env.RESET_TOKEN_EXPIRATION_MINUTES, 10),

  // Password hashing cost.
  BCRYPT_ROUNDS: toPositiveInt(process.env.BCRYPT_ROUNDS, 10),

  // Secret used to HMAC the OTP before storage so a database leak does not allow
  // offline brute-forcing of the 6-digit code. Falls back to JWT_SECRET.
  OTP_HASH_SECRET: process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "techshop-otp-secret",

  // The only OTP purpose used today; kept as a constant so the value never drifts
  // between the model enum and the queries.
  PASSWORD_RESET_PURPOSE: "PASSWORD_RESET",
};
