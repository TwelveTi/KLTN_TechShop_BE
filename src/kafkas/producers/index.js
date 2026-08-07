const kafka = require("../../configs/kafka");
const logger = require("../../utils/logger");

// Shared, lazily-connected producer used by all feature producers.
class KafkaProducerClient {
  constructor() {
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    await this.producer.connect();
    this.isConnected = true;
    logger.info("Kafka producer connected");
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    await this.producer.disconnect();
    this.isConnected = false;
    logger.info("Kafka producer disconnected");
  }

  async publish(topic, message, key = null) {
    if (!this.isConnected) {
      await this.connect();
    }

    const value = typeof message === "string" ? message : JSON.stringify(message);

    await this.producer.send({
      topic,
      messages: [{ key, value }],
    });
  }
}

module.exports = new KafkaProducerClient();
