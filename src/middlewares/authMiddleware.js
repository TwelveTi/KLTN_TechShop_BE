const db = require("../models");
const AppError = require("../utils/AppError");
const jwtUtils = require("../utils/jwt");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Access token is required", 401));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwtUtils.verifyAccess(token);

    const user = await db.User.findByPk(decoded.id, {
      attributes: ["id", "email", "fullName", "phone", "avatarUrl", "avatarPublicId", "role", "status"],
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new AppError("Unauthorized", 401));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to access this resource", 403));
    }

    return next();
  };
};

module.exports = {
  authMiddleware,
  authorizeRoles,
};
