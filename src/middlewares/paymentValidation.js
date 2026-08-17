const AppError = require("../utils/AppError");

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateCreateVnpayUrl = (req, res, next) => {
  if (!req.body.orderId || !uuidRegex.test(String(req.body.orderId))) {
    return next(new AppError("Valid orderId is required", 400));
  }

  // `returnUrl` is accepted for backwards compatibility with the frontend but
  // deliberately ignored: the gateway must return to this server so the
  // signature can be verified, and echoing a caller-supplied URL back into a
  // redirect would be an open redirect.
  delete req.body.returnUrl;

  return next();
};

module.exports = {
  validateCreateVnpayUrl,
};
