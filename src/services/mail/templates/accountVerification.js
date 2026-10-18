const { layout, button, escapeHtml, styles } = require("./layout");

// Nội dung thư xác minh tài khoản. Khung, màu và chữ dùng chung ở layout.js.
function accountVerificationTemplate({ fullName, verifyUrl }) {
  const safeName = fullName ? String(fullName) : "there";
  const subject = "Welcome to TechShop — please verify your email";

  const text = [
    `Hi ${safeName},`,
    "",
    "Thanks for creating a TechShop account.",
    "Please confirm your email address by opening the link below:",
    "",
    verifyUrl,
    "",
    "Clicking the link verifies your account and takes you to the TechShop home page.",
    "If you did not create this account, you can safely ignore this email.",
    "",
    "— The TechShop Team",
  ].join("\n");

  const name = escapeHtml(safeName);
  const html = layout({
    title: subject,
    preheader: "Confirm your email to finish setting up your TechShop account.",
    body: `<h1 style="${styles.h1}">Welcome, ${name}!</h1>
              <p style="${styles.p}">Thanks for creating a TechShop account. Confirm your email address to finish setting it up. The link works once and expires after 24 hours.</p>
              ${button(verifyUrl, "Verify my email")}
              <p style="${styles.small}">If the button does not work, open this link:<br /><a href="${verifyUrl}" style="${styles.link}">${verifyUrl}</a></p>`,
    footnote: "If you did not create this account, you can safely ignore this email.",
  });

  return { subject, html, text };
}

module.exports = { accountVerificationTemplate };
