const logger = require("../../utils/logger");
const { EMAIL_EVENTS } = require("../topics");
const emailService = require("../../services/mail/emailService");

// Routes an incoming email event to the correct email service method.
// Errors are swallowed (logged) so a single bad message does not block the
// consumer or trigger an infinite redelivery loop.
async function handleEmailEvent(event) {
  const { type, to, payload } = event || {};

  try {
    switch (type) {
      case EMAIL_EVENTS.ACCOUNT_VERIFICATION:
        await emailService.sendAccountVerification({
          to,
          fullName: payload?.fullName,
          verifyToken: payload?.verifyToken,
        });
        break;

      default:
        logger.warn("Received unknown email event type", { type });
    }
  } catch (error) {
    logger.error("Failed to handle email event", {
      type,
      to,
      error: logger.serializeError(error),
    });
  }
}

module.exports = { handleEmailEvent };
