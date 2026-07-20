const APIResponse = require("../utils/ApiResponse");
const { getErrorConfig } = require("../utils/errorMap");
const logger = require("../utils/logger");
const uploadService = require("../services/uploadService");

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const cleanupFailedProductCreateUploads = async (req) => {
  if (req.method !== "POST" || req.originalUrl !== "/api/v1/admin/products") {
    return;
  }

  const publicIds = Array.isArray(req.body?.images)
    ? req.body.images.map((image) => image?.publicId).filter(Boolean)
    : [];

  if (!publicIds.length) {
    return;
  }

  logger.warn("Cleaning up uploaded images after failed product create", {
    requestId: req.requestId,
    publicIds,
  });

  await uploadService.deleteMany(publicIds, { requestId: req.requestId });
};

const errorHandler = async (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const knownError = getErrorConfig(error.name);
  const statusCode = error.statusCode || knownError?.statusCode || 500;
  const message = knownError?.getMessage
    ? knownError.getMessage(error)
    : knownError?.message || (statusCode === 500 ? "Internal server error" : error.message);

  logger.error("Request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: logger.serializeError(error),
  });

  try {
    await cleanupFailedProductCreateUploads(req);
  } catch (cleanupError) {
    logger.error("Failed to clean up uploaded images after product create error", {
      requestId: req.requestId,
      error: logger.serializeError(cleanupError),
    });
  }

  return APIResponse.error(res, message, statusCode, {
    requestId: req.requestId,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
