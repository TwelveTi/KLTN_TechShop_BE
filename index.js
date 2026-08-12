require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const route = require("./src/routes/index");
const connectDB = require("./src/utils/connectDB");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const http = require("http");
const APIResponse = require("./src/utils/ApiResponse");
const logger = require("./src/utils/logger");
const uploadService = require("./src/services/uploadService");
const kafkaManager = require("./src/kafkas");
const { passport } = require("./src/configs/passport");

const app = express();
const server = http.createServer(app);
const corsOrigin = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? false : true);

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

connectDB().then(async () => {
  const port = process.env.PORT || 3000;
  const hostname = process.env.HOST_NAME || "localhost";

  server.listen(port, hostname, () => {
    console.log(`Server is running at http://${hostname}:${port}`);
  });

  // Kafka is best-effort: if the broker is down, the API still serves requests
  try {
    await kafkaManager.init();
  } catch (error) {
    logger.error("Kafka initialization failed; continuing without Kafka", {
      error: logger.serializeError(error),
    });
  }
});

async function shutdown(signal) {
  logger.warn("Shutting down server", { signal });

  await kafkaManager.shutdown();

  server.close(() => process.exit(0));

  // Force exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
