// Hashing / comparison helpers for the password-management flow. All crypto
// lives here (out of the service) so the algorithms and secrets are used
// consistently and can be unit-tested in isolation.
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { BCRYPT_ROUNDS, OTP_HASH_SECRET } = require("../configs/passwordConfig");

// bcrypt hash / verify for account passwords.
const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
const comparePassword = (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash);

// HMAC-SHA256 of the OTP. The plaintext code is NEVER stored — only this digest.
const hashOtp = (otp) => crypto.createHmac("sha256", OTP_HASH_SECRET).update(String(otp)).digest("hex");

// Constant-time comparison of two hex digests (avoids timing side-channels when
// matching the submitted OTP against the stored hash).
const safeEqualHex = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

// Opaque, high-entropy reset authorization token handed to the client after a
// successful OTP verification (stored only as its SHA-256 via tokenHash util).
const generateResetToken = () => crypto.randomBytes(32).toString("hex");

module.exports = {
  hashPassword,
  comparePassword,
  hashOtp,
  safeEqualHex,
  generateResetToken,
};
