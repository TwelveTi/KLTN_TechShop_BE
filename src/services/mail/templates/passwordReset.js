const { layout, escapeHtml, styles } = require("./layout");

// Nội dung thư mã OTP đặt lại mật khẩu: chỉ có mã, hạn dùng và lời nhắc bảo mật.
function passwordResetTemplate({ fullName, otp, expiresMinutes }) {
  const safeName = fullName ? String(fullName) : "there";
  const code = String(otp);
  const minutes = Number(expiresMinutes) || 10;
  const subject = "Your TechShop password reset code";

  const text = [
    `Hi ${safeName},`,
    "",
    "We received a request to reset your TechShop password.",
    `Your verification code is: ${code}`,
    "",
    `This code expires in ${minutes} minutes.`,
    "",
    "If you did not request a password reset, you can safely ignore this email —",
    "your password will remain unchanged. Never share this code with anyone.",
    "",
    "— The TechShop Team",
  ].join("\n");

  const name = escapeHtml(safeName);
  const html = layout({
    title: subject,
    preheader: `Your TechShop verification code expires in ${minutes} minutes.`,
    body: `<h1 style="${styles.h1}">Password reset code</h1>
              <p style="${styles.p}">Hi ${name}, we received a request to reset your TechShop password. Enter this code on the reset page to continue.</p>
              <p style="margin:0 0 20px;"><span style="${styles.code}">${escapeHtml(code)}</span></p>
              <p style="${styles.p}">The code expires in <strong style="color:#111827;">${minutes} minutes</strong>.</p>`,
    footnote:
      "If you did not request a password reset, you can ignore this email and your password stays the same. Never share this code with anyone.",
  });

  return { subject, html, text };
}

module.exports = { passwordResetTemplate };
