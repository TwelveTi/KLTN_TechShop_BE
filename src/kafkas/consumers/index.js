const emailConsumer = require("./emailConsumer");

// Registry of consumers the KafkaManager should start.
module.exports = [emailConsumer];
