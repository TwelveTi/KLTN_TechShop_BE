const db = require("../models");
const AppError = require("../utils/AppError");
const jwtUtils = require("../utils/jwt");
const authRepository = require("../repositories/authRepository");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Access token is required", 401));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwtUtils.verifyAccess(token);

    // Access token phải thuộc một phiên còn sống. Thiếu bước này thì máy bị thu hồi phiên
    // vẫn dùng token cũ thêm tối đa 15 phút cho tới khi token hết hạn.
    if (!decoded.sid || !(await authRepository.findLiveSession(decoded.sid, decoded.id))) {
      return next(new AppError("Session has been revoked", 401));
    }

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
// A bad token is treated as "no user". An EXPIRED one answers 401 so the client
// refreshes and retries; treating it as a guest would file the user's data under
// the guest session (e.g. AI history vanishing after F5).
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const decoded = jwtUtils.verifyAccess(authHeader.split(" ")[1]);
    // Phiên đã thu hồi thì coi như khách, giống authMiddleware.
    if (!decoded.sid || !(await authRepository.findLiveSession(decoded.sid, decoded.id))) {
      return next();
    }
    const user = await db.User.findByPk(decoded.id, {
      attributes: ["id", "email", "role", "status"],
    });

    if (user && user.status === "ACTIVE") {
      req.user = user;
    }
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Access token expired", 401));
    }
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
