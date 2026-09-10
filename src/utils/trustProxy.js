const logger = require("./logger");

// Express mặc định không tin proxy nào: `req.ip` là địa chỉ của peer TCP. Sau
// một reverse proxy (Nginx, Railway, Render), peer đó CHÍNH LÀ proxy — nên mọi
// request trông như đến từ một IP duy nhất và cả site dùng chung một xô rate
// limit: một kẻ tấn công tiêu hết hạn mức là mọi người cùng nhận 429.
//
// Nhưng cách sửa không phải là tin tất cả. `trust proxy = true` cho phép bất kỳ
// ai đặt header `X-Forwarded-For` tự xưng là một IP khác, và khi đó rate limit
// theo IP hỏng theo chiều ngược lại: mỗi request là một "IP" mới, không xô nào
// đầy được nữa. Một cấu hình sai kiểu này còn tệ hơn không cấu hình, vì nó trông
// như đã sửa.
//
// Con số đúng là SỐ CHẶNG proxy mà request thật sự đi qua — thường là 1. Express
// khi đó đọc IP thứ `n` tính từ cuối `X-Forwarded-For`, tức phần header do chính
// proxy của mình ghi, không phải phần client gửi lên.

const DISABLED_VALUES = new Set(["false", "0", "off", "no"]);
const ENABLED_VALUES = new Set(["true", "on", "yes"]);

function resolveTrustProxy(raw, nodeEnv) {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!value) {
    return {
      value: false,
      description: "false (không tin proxy nào)",
      // Chạy localhost thì đây là cấu hình đúng, nên chỉ cảnh báo ở production.
      warning:
        nodeEnv === "production"
          ? "TRUST_PROXY chưa đặt. Sau reverse proxy, mọi request mang IP của proxy nên toàn bộ site dùng chung một xô rate limit. Đặt TRUST_PROXY=1 (hoặc đúng số chặng proxy)."
          : null,
    };
  }

  const lowered = value.toLowerCase();

  if (DISABLED_VALUES.has(lowered)) {
    return { value: false, description: "false (không tin proxy nào)", warning: null };
  }

  if (ENABLED_VALUES.has(lowered)) {
    return {
      value: true,
      description: "true (tin MỌI proxy)",
      warning:
        "TRUST_PROXY=true cho phép client tự khai X-Forwarded-For, nên rate limit theo IP mất tác dụng. Dùng số chặng proxy (thường TRUST_PROXY=1) thay vì true.",
    };
  }

  if (/^\d+$/.test(lowered)) {
    const hops = Number(lowered);

    return {
      value: hops,
      description: hops === 0 ? "0 (không tin proxy nào)" : `${hops} chặng proxy`,
      warning: null,
    };
  }

  // Còn lại: danh sách IP / dải CIDR / tên dải có sẵn của Express
  // ("loopback", "linklocal", "uniquelocal"). Chính xác nhất khi biết trước địa
  // chỉ của proxy, vì nó không phụ thuộc vào việc đếm đúng số chặng.
  const list = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    value: list.length === 1 ? list[0] : list,
    description: `chỉ tin: ${list.join(", ")}`,
    warning: null,
  };
}

// Phải chạy TRƯỚC mọi middleware đọc `req.ip` (rate limit, logger), nên đặt ngay
// sau `express()`.
function configureTrustProxy(app, options = {}) {
  const raw = options.raw !== undefined ? options.raw : process.env.TRUST_PROXY;
  const nodeEnv = options.nodeEnv !== undefined ? options.nodeEnv : process.env.NODE_ENV;

  const { value, description, warning } = resolveTrustProxy(raw, nodeEnv);

  app.set("trust proxy", value);

  if (warning) {
    logger.warn(warning, { trustProxy: description });
  } else {
    logger.info("Trust proxy configured", { trustProxy: description });
  }

  return value;
}

module.exports = { configureTrustProxy, resolveTrustProxy };
