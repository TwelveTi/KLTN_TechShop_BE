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
      attributes: ["id", "email", "fullName", "phone", "avatarUrl", "avatarPublicId", "role", "status", "emailVerifiedAt"],
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

// Gate for features that should be restricted until the user verifies their
// email. Use after authMiddleware, e.g. on checkout/order-create routes:
//   router.post("/orders", authMiddleware, requireVerifiedEmail, ...)
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Access token is required", 401));
  }

  if (!req.user.emailVerifiedAt) {
    return next(new AppError("Please verify your email to use this feature", 403));
  }

  return next();
};

// Attaches req.user when a valid token is present, and simply continues when it
// is not. For endpoints that serve both shoppers and anonymous visitors —
// behaviour tracking is the case that needs it, because the browsing that
// matters most to recommendations happens before anyone signs in.
//
// Never fails the request: a bad or expired token is treated as "no user", not
// as an error, otherwise a stale token in localStorage would break browsing.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const decoded = jwtUtils.verifyAccess(authHeader.split(" ")[1]);
    const user = await db.User.findByPk(decoded.id, {
      attributes: ["id", "email", "role", "status"],
    });

    if (user && user.status === "ACTIVE") {
      req.user = user;
    }
  } catch {
    // Anonymous is a valid outcome here.
  }

  return next();
};

module.exports = {
  authMiddleware,
  authorizeRoles,
  requireVerifiedEmail,
  optionalAuth,
};
