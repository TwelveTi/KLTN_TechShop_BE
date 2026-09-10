require("dotenv").config();
const jwt = require("jsonwebtoken");

const MIN_SECRET_LENGTH = 32;

const requireStrongSecret = (name, value) => {
  const secret = typeof value === "string" ? value.trim() : "";

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} phải dài ít nhất ${MIN_SECRET_LENGTH} ký tự (hiện ${secret.length}). ` +
        `Sinh khoá mới: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
  }

  return secret;
};

const JWT_SECRET = requireStrongSecret("JWT_SECRET", process.env.JWT_SECRET);
const JWT_REFRESH_SECRET = requireStrongSecret("JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET);


const EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET?.trim() || JWT_SECRET;
const EMAIL_TOKEN_EXPIRES_IN = process.env.EMAIL_TOKEN_EXPIRES_IN || "24h";


const PURPOSE = {
  ACCESS: "access",
  REFRESH: "refresh",
  VERIFY_EMAIL: "verify-email",
};

const verifyWithPurpose = (token, secret, expected) => {
  const decoded = jwt.verify(token, secret);

  if (decoded.purpose !== expected) {
    throw new jwt.JsonWebTokenError("Invalid token purpose");
  }

  return decoded;
};

class JwtUtils {
  signAccess(payload) {
    return jwt.sign({ ...payload, purpose: PURPOSE.ACCESS }, JWT_SECRET, { expiresIn: "15m" });
  }

  signRefresh(payload) {
    return jwt.sign({ ...payload, purpose: PURPOSE.REFRESH }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
  }

  verifyAccess(token) {
    return verifyWithPurpose(token, JWT_SECRET, PURPOSE.ACCESS);
  }

  verifyRefresh(token) {
    return verifyWithPurpose(token, JWT_REFRESH_SECRET, PURPOSE.REFRESH);
  }

  // Short-lived, single-purpose token embedded in the email verification link.
  signEmailToken(payload) {
    return jwt.sign({ ...payload, purpose: PURPOSE.VERIFY_EMAIL }, EMAIL_TOKEN_SECRET, {
      expiresIn: EMAIL_TOKEN_EXPIRES_IN,
    });
  }

  verifyEmailToken(token) {
    return verifyWithPurpose(token, EMAIL_TOKEN_SECRET, PURPOSE.VERIFY_EMAIL);
  }
}

module.exports = new JwtUtils();
module.exports.PURPOSE = PURPOSE;
module.exports.MIN_SECRET_LENGTH = MIN_SECRET_LENGTH;
