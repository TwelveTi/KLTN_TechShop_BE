const producer = require("./index");
const logger = require("../../utils/logger");
const { TOPICS, EMAIL_EVENTS } = require("../topics");

const isKafkaEnabled = () => process.env.KAFKA_ENABLED !== "false";

// Publishing is fault-tolerant on purpose: a Kafka outage must never break
// the caller (e.g. user registration still succeeds even if email is delayed).
async function publishAccountVerification({ userId, to, fullName, verifyToken }, meta = {}) {
  if (!isKafkaEnabled()) {
    logger.warn("Kafka disabled, skipping account verification email event", { to });
    return;
  }

  const event = {
    type: EMAIL_EVENTS.ACCOUNT_VERIFICATION,
    to,
    payload: { userId, fullName, verifyToken },
    meta: {
      requestId: meta.requestId,
      occurredAt: new Date().toISOString(),
    },
  };

  try {
    await producer.publish(TOPICS.EMAIL, event, to);
    logger.info("Published account verification email event", {
      requestId: meta.requestId,
      to,
    });
  } catch (error) {
    logger.error("Failed to publish account verification email event", {
      requestId: meta.requestId,
      to,
      error: logger.serializeError(error),
    });
  }
}

// Password reset OTP email. The OTP is carried in the event payload but is
// NEVER logged (logs only reference the recipient). Like the verification
// email, a Kafka outage is swallowed so the caller is never broken.
async function publishPasswordReset({ userId, to, fullName, otp, expiresMinutes }, meta = {}) {
  if (!isKafkaEnabled()) {
    logger.warn("Kafka disabled, skipping password reset email event", { to });
    return;
  }

  const event = {
    type: EMAIL_EVENTS.PASSWORD_RESET,
    to,
    payload: { userId, fullName, otp, expiresMinutes },
    meta: {
      requestId: meta.requestId,
      occurredAt: new Date().toISOString(),
    },
  };

  try {
    await producer.publish(TOPICS.EMAIL, event, to);
    logger.info("Published password reset email event", {
      requestId: meta.requestId,
      to,
    });
  } catch (error) {
    logger.error("Failed to publish password reset email event", {
      requestId: meta.requestId,
      to,
      error: logger.serializeError(error),
    });
  }
}

module.exports = { publishAccountVerification, publishPasswordReset };
