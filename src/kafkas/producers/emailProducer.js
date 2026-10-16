const producer = require("./index");
const logger = require("../../utils/logger");
const { TOPICS, EMAIL_EVENTS } = require("../topics");
const { handleEmailEvent } = require("../handlers/emailHandler");

const isKafkaEnabled = () => process.env.KAFKA_ENABLED !== "false";

// Không có Kafka (tắt hẳn, hoặc broker lỗi) thì gửi thẳng qua đúng hàm consumer dùng,
// để môi trường không dựng Kafka như staging vẫn gửi được mail. Khi chạy test thì bỏ qua.
function sendDirectly(event, reason) {
  if (process.env.NODE_ENV === "test") return;
  logger.warn("Sending email directly without Kafka", { type: event.type, to: event.to, reason });
  // Không await: request đăng ký không phải chờ SMTP. handleEmailEvent tự nuốt lỗi.
  handleEmailEvent(event);
}

// Publishing is fault-tolerant on purpose: a Kafka outage must never break
// the caller (e.g. user registration still succeeds even if email is delayed).
async function publish(event, meta, label) {
  if (!isKafkaEnabled()) {
    sendDirectly(event, "kafka disabled");
    return;
  }

  try {
    await producer.publish(TOPICS.EMAIL, event, event.to);
    logger.info(`Published ${label} email event`, { requestId: meta.requestId, to: event.to });
  } catch (error) {
    logger.error(`Failed to publish ${label} email event`, {
      requestId: meta.requestId,
      to: event.to,
      error: logger.serializeError(error),
    });
    sendDirectly(event, "kafka publish failed");
  }
}

async function publishAccountVerification({ userId, to, fullName, verifyToken }, meta = {}) {
  const event = {
    type: EMAIL_EVENTS.ACCOUNT_VERIFICATION,
    to,
    payload: { userId, fullName, verifyToken },
    meta: { requestId: meta.requestId, occurredAt: new Date().toISOString() },
  };
  return publish(event, meta, "account verification");
}

// Password reset OTP email. The OTP is carried in the event payload but is
// NEVER logged (logs only reference the recipient).
async function publishPasswordReset({ userId, to, fullName, otp, expiresMinutes }, meta = {}) {
  const event = {
    type: EMAIL_EVENTS.PASSWORD_RESET,
    to,
    payload: { userId, fullName, otp, expiresMinutes },
    meta: { requestId: meta.requestId, occurredAt: new Date().toISOString() },
  };
  return publish(event, meta, "password reset");
}

module.exports = { publishAccountVerification, publishPasswordReset };
