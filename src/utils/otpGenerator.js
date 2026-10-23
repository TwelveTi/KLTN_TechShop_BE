const crypto = require("crypto");

class OtpGenerator {
    // crypto.randomInt là nguồn ngẫu nhiên an toàn mật mã; Math.random đoán được nên không dùng cho OTP.
    static generate(length = 6) {
        if (length < 4 || length > 10) {
            throw new Error("OTP length must be between 4 and 10 digits");
        }

        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length);

        return crypto.randomInt(min, max);
    }
}

module.exports = OtpGenerator;
