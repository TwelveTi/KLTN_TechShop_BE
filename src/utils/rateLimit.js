const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const APIResponse = require("./ApiResponse");
const logger = require("./logger");

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Khoá theo IP, an toàn với IPv6. Một nhà mạng IPv6 cấp cho mỗi thuê bao nguyên
// một dải /64, nên khoá theo địa chỉ đầy đủ là tặng không kẻ tấn công 2⁶⁴ lượt
// thử; `ipKeyGenerator` gộp về /56 trước khi làm khoá.
const byIp = (req) => ipKeyGenerator(req.ip);

// Khoá theo (IP, email). Dò mật khẩu của MỘT tài khoản và rải một mật khẩu qua
// NHIỀU tài khoản là hai chiều tấn công khác nhau, và một xô duy nhất chỉ chặn
// được một chiều. Xô này chặn chiều thứ nhất, xô theo IP chặn chiều thứ hai —
// vì vậy `/auth/login` mang cả hai.
//
// Email vẫn kèm IP chứ không đứng một mình: khoá chỉ theo email sẽ cho phép một
// người lạ tiêu hết hạn mức đăng nhập của người khác, tức biến limiter thành
// công cụ khoá tài khoản người dùng thật.
//
// Chuẩn hoá email ngay tại đây thay vì tin `authValidation`, vì limiter chạy
// TRƯỚC validation (không nên tốn công validate một request đã vượt hạn mức),
// nên "A@x.com" và " a@x.com" phải tự gộp về cùng một khoá.
const byIpAndEmail = (req) => {
  const raw = req.body?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 255) : "";

  return `${ipKeyGenerator(req.ip)}|${email}`;
};

function createRateLimiter({
  name,
  windowMs,
  limit,
  message = "Too many requests. Please try again later.",
  keyGenerator = byIp,
  skipSuccessfulRequests = false,
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    // Với các đường dò mật khẩu/OTP: chỉ đếm lần THẤT BẠI. Người dùng thật đăng
    // nhập đúng mười lần trong ngày không phải là thứ cần chặn.
    skipSuccessfulRequests,
    keyGenerator,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / SECOND))
        : Math.ceil(windowMs / SECOND);

      // Cố ý KHÔNG log email đã thử: log của một endpoint đăng nhập là chỗ dễ
      // biến thành danh sách địa chỉ người dùng nhất.
      logger.warn("Rate limit exceeded", {
        requestId: req.requestId,
        limiter: name,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        used: req.rateLimit?.used,
        retryAfterSeconds,
      });

      return APIResponse.error(res, message, 429, {
        requestId: req.requestId,
        retryAfterSeconds,
      });
    },
  });
}

module.exports = {
  createRateLimiter,
  byIp,
  byIpAndEmail,
  SECOND,
  MINUTE,
  HOUR,
};
