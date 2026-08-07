const nodemailer = require("nodemailer");
const logger = require("../../utils/logger");

let transporter = null;

// Transport is created lazily and reused. Defaults target the Mailpit
// container from docker-compose.yml (host localhost:1025, no auth), so the
// whole flow works locally without a real SMTP account. Switching to Gmail,
// SendGrid, Mailgun, etc. is only an env change.
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST || "localhost";
  const port = Number(process.env.SMTP_PORT) || 1025;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const options = { host, port, secure };

  if (user && pass) {
    options.auth = { user, pass };
  }

  transporter = nodemailer.createTransport(options);
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM || "TechShop <no-reply@techshop.local>";

  const info = await getTransporter().sendMail({ from, to, subject, html, text });

  logger.info("Email sent", {
    to,
    subject,
    messageId: info.messageId,
  });

  return info;
}

module.exports = { sendMail, getTransporter };
