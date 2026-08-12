const { sendMail } = require("./mailer");
const { accountVerificationTemplate } = require("./templates/accountVerification");
const { passwordResetTemplate } = require("./templates/passwordReset");

// APP_URL is the backend's public base URL. The verify link points at the
// backend, which then verifies the token and redirects to the frontend home.
function buildVerifyUrl(token) {
  const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");
  return `${appUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
}

class EmailService {
  async sendAccountVerification({ to, fullName, verifyToken }) {
    if (!to || !verifyToken) {
      throw new Error("sendAccountVerification requires 'to' and 'verifyToken'");
    }

    const verifyUrl = buildVerifyUrl(verifyToken);
    const { subject, html, text } = accountVerificationTemplate({ fullName, verifyUrl });

    await sendMail({ to, subject, html, text });
  }

  async sendPasswordReset({ to, fullName, otp, expiresMinutes }) {
    if (!to || !otp) {
      throw new Error("sendPasswordReset requires 'to' and 'otp'");
    }

    const { subject, html, text } = passwordResetTemplate({ fullName, otp, expiresMinutes });

    await sendMail({ to, subject, html, text });
  }
}

module.exports = new EmailService();
