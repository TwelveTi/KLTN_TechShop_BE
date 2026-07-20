const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

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
}

module.exports = new JwtUtils();