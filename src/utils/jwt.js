const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET || process.env.JWT_SECRET;
const EMAIL_TOKEN_EXPIRES_IN = process.env.EMAIL_TOKEN_EXPIRES_IN || "24h";
const EMAIL_TOKEN_PURPOSE = "verify-email";

class JwtUtils {
    signAccess(payload) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
    }

    signRefresh(payload) {
        return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
    }

    verifyAccess(token) {
        return jwt.verify(token, JWT_SECRET);
    }

    verifyRefresh(token) {
        return jwt.verify(token, JWT_REFRESH_SECRET);
    }

    // Short-lived, single-purpose token embedded in the email verification link.
    signEmailToken(payload) {
        return jwt.sign(
            { ...payload, purpose: EMAIL_TOKEN_PURPOSE },
            EMAIL_TOKEN_SECRET,
            { expiresIn: EMAIL_TOKEN_EXPIRES_IN },
        );
    }

    verifyEmailToken(token) {
        const decoded = jwt.verify(token, EMAIL_TOKEN_SECRET);

        if (decoded.purpose !== EMAIL_TOKEN_PURPOSE) {
            throw new jwt.JsonWebTokenError("Invalid token purpose");
        }

        return decoded;
    }
}

module.exports = new JwtUtils();