const { Kafka, logLevel } = require("kafkajs");

// Brokers can be a comma separated list, e.g. "localhost:9092,localhost:9093".
// Default targets the single-node broker from docker-compose.yml.
const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "techshop-backend",
  brokers,
  retry: { retries: 8, initialRetryTime: 300 },
  connectionTimeout: 10000,
  logLevel: logLevel.NOTHING,
});

module.exports = kafka;
