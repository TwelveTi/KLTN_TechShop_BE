const AppError = require("../utils/AppError");
const { CLIENT_REPORTABLE_TYPES } = require("../utils/behaviorSignals");

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_EVENTS = 50;
const MAX_SESSION_ID_LENGTH = 100;
const MAX_METADATA_BYTES = 4096;

const sendFirstError = (errors, next) => {
  if (errors.length > 0) {
    return next(new AppError(errors[0], 400));
  }

  return next();
};

// Anonymous visitors are identified by a client-generated id in `X-Session-Id`.
// It is never trusted for authorisation — only for grouping one visitor's own
// events before they sign in.
const attachSessionId = (req, res, next) => {
  const raw = req.headers["x-session-id"];
  const sessionId = typeof raw === "string" ? raw.trim() : "";

  req.sessionKey =
    sessionId && sessionId.length <= MAX_SESSION_ID_LENGTH && /^[A-Za-z0-9_.-]+$/.test(sessionId)
      ? sessionId
      : null;

  return next();
};

const validateEvent = (raw, index, errors) => {
  const label = `Event ${index + 1}`;

  if (!raw || typeof raw !== "object") {
    errors.push(`${label} is invalid`);
    return null;
  }

  // Deliberately narrow: a client may only report what the server cannot see
  // for itself. Accepting PURCHASE here would let a caller inflate their own
  // signals and poison their recommendations (or a shared popularity score).
  if (!CLIENT_REPORTABLE_TYPES.includes(raw.behaviorType)) {
    errors.push(`${label}: behaviorType must be one of: ${CLIENT_REPORTABLE_TYPES.join(", ")}`);
    return null;
  }

  const event = { behaviorType: raw.behaviorType, productId: null, categoryId: null, metadata: null };

  for (const field of ["productId", "categoryId"]) {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== "") {
      if (!uuidRegex.test(String(raw[field]))) {
        errors.push(`${label}: ${field} must be a valid id`);
        return null;
      }
      event[field] = String(raw[field]);
    }
  }

  if (raw.metadata !== undefined && raw.metadata !== null) {
    if (typeof raw.metadata !== "object" || Array.isArray(raw.metadata)) {
      errors.push(`${label}: metadata must be an object`);
      return null;
    }

    if (Buffer.byteLength(JSON.stringify(raw.metadata), "utf8") > MAX_METADATA_BYTES) {
      errors.push(`${label}: metadata is too large`);
      return null;
    }

    event.metadata = raw.metadata;
  }

  return event;
};

// Accepts either a single event or `{ events: [...] }`, so a page can report one
// click without wrapping it, and a batch flush can send many.
const validateTrackBehavior = (req, res, next) => {
  const errors = [];
  const raw = Array.isArray(req.body?.events) ? req.body.events : [req.body];

  if (raw.length === 0) {
    errors.push("At least one event is required");
    return sendFirstError(errors, next);
  }

  if (raw.length > MAX_EVENTS) {
    errors.push(`At most ${MAX_EVENTS} events can be sent at once`);
    return sendFirstError(errors, next);
  }

  const events = [];
  raw.forEach((event, index) => {
    const parsed = validateEvent(event, index, errors);
    if (parsed) {
      events.push(parsed);
    }
  });

  req.body.events = events;

  return sendFirstError(errors, next);
};

module.exports = {
  attachSessionId,
  validateTrackBehavior,
};
