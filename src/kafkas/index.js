const kafka = require("../configs/kafka");
const logger = require("../utils/logger");
const { TOPICS } = require("./topics");
const producer = require("./producers");
const consumers = require("./consumers");

class KafkaManager {
  constructor() {
    this.kafka = kafka;
    this.producer = producer;
    this.consumers = consumers;

    // Topics to check/create on startup (single-node dev defaults).
    this.topics = [
      { topic: TOPICS.EMAIL, numPartitions: 1, replicationFactor: 1 },
    ];

    this.started = false;
  }

  async ensureTopics() {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      const existingTopics = await admin.listTopics();
      const topicsToCreate = this.topics.filter((t) => !existingTopics.includes(t.topic));

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
        });
        logger.info("Kafka topics created", {
          topics: topicsToCreate.map((t) => t.topic),
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  async init() {
    if (process.env.KAFKA_ENABLED === "false") {
      logger.warn("Kafka is disabled (KAFKA_ENABLED=false), skipping initialization");
      return;
    }

    await this.ensureTopics();
    await this.producer.connect();

    for (const consumer of this.consumers) {
      await consumer.start();
    }

    this.started = true;
    logger.info("Kafka manager initialized");
  }

  async shutdown() {
    if (!this.started) {
      return;
    }

    try {
      for (const consumer of this.consumers) {
        await consumer.stop();
      }
      await this.producer.disconnect();
    } catch (error) {
      logger.error("Error during Kafka shutdown", {
        error: logger.serializeError(error),
      });
    } finally {
      this.started = false;
    }
  }
}

module.exports = new KafkaManager();
