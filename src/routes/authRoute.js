const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validateRegister,
  validateLogin,
  validateLogout,
  validateForgotPassword,
  validateVerifyResetOtp,
  validateResetPassword,
  validateChangePassword,
} = require("../middlewares/authValidation");
const { authMiddleware } = require("../middlewares/authMiddleware");
const passwordController = require("../controllers/passwordController");
const { validateIdParam } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");
const sessionController = require("../controllers/sessionController");
const { passport, googleEnabled } = require("../configs/passport");
const { createRateLimiter, byIpAndEmail, MINUTE, HOUR } = require("../utils/rateLimit");

const FRONTEND_URL = (process.env.FRONTEND_URL).replace(/\/+$/, "");

// Limiter chung theo IP ở `index.js` (300 req/15 phút ở production) là hạn mức
// cho MỌI traffic gộp lại — duyệt sản phẩm, gọi giỏ hàng, tải ảnh. Nó rộng đúng
// bằng mức cần thiết để không cản người dùng thật, nên nó không phải là thứ
// chặn được dò mật khẩu: 300 lượt thử mỗi 15 phút cho mỗi IP là một tốc độ dò
// hoàn toàn dùng được. Các đường dưới đây vì vậy có hạn mức riêng, hẹp hơn
// nhiều, và đo trên một xô khác.
//
// Cả bộ này chỉ có ý nghĩa khi `req.ip` là IP thật của client — xem
// `utils/trustProxy.js`.

// Đăng nhập: hai tầng cùng lúc, xem `byIpAndEmail` trong `utils/rateLimit.js`.
const loginPerAccountLimiter = createRateLimiter({
  name: "auth:login:account",
  windowMs: 15 * MINUTE,
  limit: 8,
  keyGenerator: byIpAndEmail,
  skipSuccessfulRequests: true,
  message: "Too many failed login attempts. Please try again later.",
});

const loginPerIpLimiter = createRateLimiter({
  name: "auth:login:ip",
  windowMs: 15 * MINUTE,
  limit: 30,
  skipSuccessfulRequests: true,
  message: "Too many failed login attempts. Please try again later.",
});

// Đăng ký: chống bơm tài khoản rác. Mỗi lần đăng ký còn kéo theo một email xác
// thực gửi đi, nên hạn mức này bảo vệ cả hạn ngạch SMTP.
const registerLimiter = createRateLimiter({
  name: "auth:register",
  windowMs: HOUR,
  limit: 5,
  message: "Too many accounts created from this address. Please try again later.",
});

// Mọi đường khiến hệ thống GỬI một email. `passwordService` đã có cooldown
// `OTP_RESEND_COOLDOWN_SECONDS`, nhưng cooldown đó tính theo tài khoản: nó
// không ngăn một IP quay vòng 500 địa chỉ email khác nhau.
const emailSendLimiter = createRateLimiter({
  name: "auth:email-send",
  windowMs: HOUR,
  limit: 6,
  message: "Too many email requests. Please try again later.",
});

// Kiểm OTP: mã 6 chữ số là một triệu khả năng, và `MAX_OTP_ATTEMPTS` chỉ đếm
// theo từng mã đang sống. Người dò có thể xin mã mới rồi thử lại từ đầu, nên
// cần thêm một trần theo thời gian.
const otpVerifyLimiter = createRateLimiter({
  name: "auth:otp-verify",
  windowMs: 15 * MINUTE,
  limit: 10,
  keyGenerator: byIpAndEmail,
  skipSuccessfulRequests: true,
  message: "Too many OTP attempts. Please request a new code later.",
});

// `reset-password` và `change-password` nhận secret (resetToken / mật khẩu hiện
// tại) nhưng không nhận email, nên khoá theo IP.
const passwordWriteLimiter = createRateLimiter({
  name: "auth:password-write",
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many attempts. Please try again later.",
});

// `check-email` trả lời công khai một tài khoản có tồn tại hay không (đánh đổi
// UX có ý thức, xem README 5.1). Hạn mức không bịt được kênh dò đó, nhưng biến
// nó từ "quét cả một danh sách email" thành "tra từng cái một".
const checkEmailLimiter = createRateLimiter({
  name: "auth:check-email",
  windowMs: 15 * MINUTE,
  limit: 40,
  message: "Too many lookups. Please try again later.",
});

router.get("/auth/check-email", checkEmailLimiter, asyncHandler(authController.checkEmail));
router.post("/auth/register", registerLimiter, validateRegister, asyncHandler(authController.register));
router.post("/auth/login", loginPerIpLimiter, loginPerAccountLimiter, validateLogin, asyncHandler(authController.login));
router.post("/auth/logout", validateLogout, asyncHandler(authController.logout));
// `refresh` cố ý KHÔNG có limiter riêng: client hợp lệ gọi nó mỗi 15 phút và
// nhiều tab cùng lúc, còn refresh token thì không dò được — nó là chuỗi ký,
// không phải mật khẩu người gõ ra.
router.post("/auth/refresh", asyncHandler(authController.refresh));
router.get("/auth/verify-email", asyncHandler(authController.verifyEmail));
router.post("/auth/resend-verification", emailSendLimiter, authMiddleware, asyncHandler(authController.resendVerification));
// Password management: forgot / verify OTP / reset (public) + change (auth).
router.post("/auth/forgot-password", emailSendLimiter, validateForgotPassword, asyncHandler(passwordController.forgotPassword));
router.post("/auth/resend-reset-otp", emailSendLimiter, validateForgotPassword, asyncHandler(passwordController.resendResetOtp));
router.post("/auth/verify-reset-otp", otpVerifyLimiter, validateVerifyResetOtp, asyncHandler(passwordController.verifyResetOtp));
router.post("/auth/reset-password", passwordWriteLimiter, validateResetPassword, asyncHandler(passwordController.resetPassword));
router.patch("/auth/change-password", passwordWriteLimiter, authMiddleware, validateChangePassword, asyncHandler(passwordController.changePassword));

// Profile reads/writes live in userRoute (`/users/me`) — this router only owns
// credentials and the session lifecycle.

// Session / device management (all require a valid access token).
router.get("/auth/sessions", authMiddleware, asyncHandler(sessionController.getSessions));
router.post("/auth/sessions/revoke-others", authMiddleware, asyncHandler(sessionController.revokeOtherSessions));
router.delete("/auth/sessions/:id", authMiddleware, validateIdParam(), asyncHandler(sessionController.revokeSession));

// Google OAuth (only mounted when GOOGLE_* env is configured).
if (googleEnabled) {
  router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false }),
  );

  router.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${FRONTEND_URL}/auth?oauth=error`,
    }),
    asyncHandler(authController.googleCallback),
  );
}

module.exports = router;
