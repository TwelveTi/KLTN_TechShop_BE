// Central place for Kafka topic names and event type constants.
// Keeping them here avoids typos across producers, consumers and handlers.

const TOPICS = {
  // All outbound transactional emails flow through this topic.
  EMAIL: process.env.KAFKA_TOPIC_EMAIL || "techshop.email",
};

const EMAIL_EVENTS = {
  ACCOUNT_VERIFICATION: "ACCOUNT_VERIFICATION",
  // Future: WELCOME, RESET_PASSWORD, ORDER_CONFIRMATION, ...
};

module.exports = { TOPICS, EMAIL_EVENTS };
