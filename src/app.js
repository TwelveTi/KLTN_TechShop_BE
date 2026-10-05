// Dựng Express app: middleware + route, KHÔNG mở cổng, KHÔNG nối DB/Kafka.
// Tách khỏi index.js để test API gọi thẳng `app` qua supertest.
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const route = require("./routes/index");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const APIResponse = require("./utils/ApiResponse");
const logger = require("./utils/logger");
const uploadService = require("./services/uploadService");
const { passport } = require("./configs/passport");
const { configureTrustProxy } = require("./utils/trustProxy");

const app = express();
const corsOrigin = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? false : true);

// Trước mọi middleware đọc `req.ip` — cả hai limiter và logger đều đọc, và một
// `req.ip` sai làm hỏng cả hai theo cách không nhìn thấy được: rate limit gộp
// mọi người vào một xô, log ghi lại địa chỉ của proxy.
configureTrustProxy(app);

app.use(helmet());

app.use((req, res, next) => {
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport (stateless: we use session:false and JWT, so only initialize()).
app.use(passport.initialize());

async function cleanupProductImagesFromBody(req, reason) {
  if (req.method !== "POST" || req.originalUrl !== "/api/v1/admin/products") {
    return;
  }

  const publicIds = Array.isArray(req.body?.images)
    ? req.body.images.map((image) => image?.publicId).filter(Boolean)
    : [];

  if (!publicIds.length) {
    return;
  }

  logger.warn("Cleaning up uploaded images after rejected product create", {
    requestId: req.requestId,
    reason,
    publicIds,
  });

  await uploadService.deleteMany(publicIds, { requestId: req.requestId });
}

app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === "production" ? 300 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    logger.warn("Rate limit exceeded", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });

    try {
      await cleanupProductImagesFromBody(req, "rate limit");
    } catch (cleanupError) {
      logger.error("Failed to clean up uploaded images after rate limit", {
        requestId: req.requestId,
        error: logger.serializeError(cleanupError),
      });
    }

    return APIResponse.error(res, "Too many requests. Please try again later.", 429, {
      requestId: req.requestId,
    });
  },
}));

route(app);

module.exports = app;
