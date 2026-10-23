const crypto = require("crypto");
const { readCookie } = require("../utils/authCookies");

// Chống login CSRF cho Google OAuth: phát `state` ngẫu nhiên kèm cookie, callback phải trả về đúng giá trị đó.
const OAUTH_STATE_COOKIE_NAME = "oauthState";
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

// Lax đủ dùng vì Google quay về callback bằng điều hướng GET cấp cao nhất.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction,
  sameSite: "lax",
  path: "/api/v1/auth/google",
};

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// Gắn `req.oauthState` để truyền vào passport.authenticate({ state }).
const issueOAuthState = (req, res, next) => {
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, { ...cookieOptions, maxAge: OAUTH_STATE_MAX_AGE });
  req.oauthState = state;
  return next();
};

// Cookie chỉ dùng một lần: xoá trước rồi mới so, lệch thì đưa về trang đăng nhập báo lỗi.
const verifyOAuthState = (req, res, next) => {
  const expected = readCookie(req, OAUTH_STATE_COOKIE_NAME);
  const received = typeof req.query?.state === "string" ? req.query.state : "";

  res.clearCookie(OAUTH_STATE_COOKIE_NAME, cookieOptions);

  if (!expected || !received || !safeEqual(expected, received)) {
    return res.redirect(`${frontendUrl()}/login?oauth=error`);
  }

  return next();
};

module.exports = {
  issueOAuthState,
  verifyOAuthState,
  OAUTH_STATE_COOKIE_NAME,
};
