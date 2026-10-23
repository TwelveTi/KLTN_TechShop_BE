const AppError = require("../utils/AppError");
const { LANGUAGES, DEFAULT_LANGUAGE } = require("../services/ai/prompts/guardrails");

// A shopper's question, not a prompt. The cap is what keeps someone from
// pasting a novel into a billed context window; it is generous enough that no
// real question hits it.
const MAX_MESSAGE_LENGTH = 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateAskAdvisor = (req, res, next) => {
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

  if (message === "") {
    return next(new AppError("message is required", 400));
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return next(new AppError(`message must be at most ${MAX_MESSAGE_LENGTH} characters`, 400));
  }

  req.body.message = message;

  // Rejected here rather than passed to `findByPk`: a malformed UUID makes
  // Sequelize throw a database error, which would surface as a 500 for what is
  // plainly a bad request.
  if (req.body.conversationId !== undefined && req.body.conversationId !== null) {
    if (!UUID_PATTERN.test(String(req.body.conversationId))) {
      return next(new AppError("conversationId must be a valid UUID", 400));
    }
  } else {
    req.body.conversationId = null;
  }

  return validateLanguage(req, res, next);
};

// Ngôn ngữ trả lời, theo ngôn ngữ giao diện. Không gửi thì mặc định tiếng Việt.
const validateLanguage = (req, res, next) => {
  const language = req.body?.language;

  if (language === undefined || language === null || language === "") {
    req.body = { ...req.body, language: DEFAULT_LANGUAGE };
    return next();
  }

  if (!Object.hasOwn(LANGUAGES, language)) {
    return next(new AppError(`language must be one of: ${Object.keys(LANGUAGES).join(", ")}`, 400));
  }

  return next();
};

module.exports = {
  MAX_MESSAGE_LENGTH,
  validateAskAdvisor,
  validateLanguage,
};
