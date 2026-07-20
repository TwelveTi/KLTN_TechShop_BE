const AppError = require("../utils/AppError");

const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to access this resource", 403));
    }

    return next();
  };
};

module.exports = {
  checkRole,
};
