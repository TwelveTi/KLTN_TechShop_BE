const AppError = require("../utils/AppError");

// Slugs come from our own slugify(): lowercase letters, digits and hyphens.
// Validating the shape keeps a junk path segment from reaching the database.
const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MAX_SLUG_LENGTH = 280;

const validateSlugParam =
  (paramName = "slug") =>
  (req, res, next) => {
    const slug = String(req.params[paramName] || "").trim().toLowerCase();

    if (!slug || slug.length > MAX_SLUG_LENGTH || !slugRegex.test(slug)) {
      return next(new AppError("Invalid slug", 400));
    }

    req.params[paramName] = slug;
    return next();
  };

module.exports = { validateSlugParam };
