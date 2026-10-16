// Không có Kafka thì mail vẫn phải được gửi thẳng, không bị bỏ đi trong im lặng.
// Thay hàm gửi SMTP bằng hàm ghi lại nên không có mail thật nào đi ra.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "test-secret-that-is-long-enough-for-jwt-checks";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-long-enough-for-checks";

const emailService = require("../src/services/mail/emailService");
const kafkaProducer = require("../src/kafkas/producers");
const { publishAccountVerification, publishPasswordReset } = require("../src/kafkas/producers/emailProducer");

let sent;
beforeEach(() => {
  sent = [];
  emailService.sendAccountVerification = async (args) => sent.push(["verify", args.to]);
  emailService.sendPasswordReset = async (args) => sent.push(["reset", args.to]);
  process.env.NODE_ENV = "development";
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("Kafka tắt thì mail xác minh được gửi thẳng", async () => {
  process.env.KAFKA_ENABLED = "false";
  await publishAccountVerification({ userId: "u1", to: "a@example.com", fullName: "A", verifyToken: "t" });
  await settle();
  assert.deepEqual(sent, [["verify", "a@example.com"]]);
});

test("Kafka bật nhưng gửi lên broker lỗi thì vẫn gửi thẳng", async () => {
  process.env.KAFKA_ENABLED = "true";
  const original = kafkaProducer.publish;
  kafkaProducer.publish = async () => {
    throw new Error("broker down");
  };
  try {
    await publishPasswordReset({ userId: "u1", to: "b@example.com", fullName: "B", otp: "123456", expiresMinutes: 10 });
    await settle();
    assert.deepEqual(sent, [["reset", "b@example.com"]]);
  } finally {
    kafkaProducer.publish = original;
  }
});

test("đang chạy test thì không gửi mail", async () => {
  process.env.KAFKA_ENABLED = "false";
  process.env.NODE_ENV = "test";
  await publishAccountVerification({ userId: "u1", to: "c@example.com", fullName: "C", verifyToken: "t" });
  await settle();
  assert.deepEqual(sent, []);
});
