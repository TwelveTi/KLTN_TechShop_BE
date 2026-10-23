const crypto = require("crypto");

// Must stay identical to how refresh tokens are hashed in authService, so a
// refresh token from the cookie can be matched against refresh_tokens.token_hash.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Khoá của bảng login_email_lockouts: cùng một email luôn ra cùng một khoá, dù hoa thường hay thừa khoảng trắng.
function loginLockoutKey(email) {
  return hashToken(String(email || "").trim().toLowerCase());
}

module.exports = { hashToken, loginLockoutKey };
