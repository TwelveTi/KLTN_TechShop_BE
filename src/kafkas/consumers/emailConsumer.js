const kafka = require("../../configs/kafka");
const logger = require("../../utils/logger");
const { TOPICS } = require("../topics");
const { handleEmailEvent } = require("../handlers/emailHandler");

const GROUP_ID = process.env.KAFKA_GROUP_ID || "techshop-email-consumer";

// This consumer is intentionally thin: it only receives, parses and delegates.
// All email building/sending logic lives in ../handlers + services/mail.
class EmailConsumer {
  constructor() {
    this.consumer = kafka.consumer({ groupId: GROUP_ID });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPICS.EMAIL, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const raw = message.value ? message.value.toString() : null;

        if (!raw) {
          return;
        }

        let event;

        try {
          event = JSON.parse(raw);
        } catch (error) {
          logger.error("Received invalid email event payload", {
            topic,
            partition,
            error: logger.serializeError(error),
          });
          return;
        }

        // Delegate everything to the handler (kept outside the consumers folder).
        await handleEmailEvent(event);
      },
    });

    logger.info("Kafka email consumer started", { groupId: GROUP_ID, topic: TOPICS.EMAIL });
  }

  async stop() {
    await this.consumer.disconnect();
  }
}

module.exports = new EmailConsumer();
