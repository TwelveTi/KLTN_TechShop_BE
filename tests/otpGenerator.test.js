// Test sinh OTP: đủ số chữ số và lấy từ nguồn ngẫu nhiên an toàn, không dùng Math.random.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const OtpGenerator = require("../src/utils/otpGenerator");

test("OTP 6 chữ số luôn nằm trong khoảng 100000..999999", () => {
  for (let i = 0; i < 2000; i += 1) {
    const otp = OtpGenerator.generate(6);
    assert.ok(Number.isInteger(otp));
    assert.ok(otp >= 100000 && otp <= 999999, `OTP ngoài khoảng: ${otp}`);
  }
});

test("sinh OTP không gọi Math.random", (t) => {
  t.mock.method(Math, "random", () => {
    throw new Error("Math.random không được dùng cho OTP");
  });

  assert.equal(String(OtpGenerator.generate(6)).length, 6);
});

test("độ dài ngoài 4..10 bị từ chối", () => {
  assert.throws(() => OtpGenerator.generate(3));
  assert.throws(() => OtpGenerator.generate(11));
});
