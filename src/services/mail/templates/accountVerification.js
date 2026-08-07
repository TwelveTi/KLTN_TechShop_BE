// Returns the subject / html / text for the account verification email.
// Plain function templates keep us free of any templating-engine dependency
// and match the TechShop frontend brand palette (primary #2563EB).
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB,#06B6D4);padding:28px 32px;">
              <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.02em;">TechShop</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">Welcome, ${safeName}!</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4B5563;">
                Thank you for creating a TechShop account. Please verify your email address to activate your account and start shopping.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#2563EB;">
                    <a href="${verifyUrl}" target="_blank"
                      style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">
                      Verify my email &amp; go to TechShop
                    </a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9CA3AF;">
                If you did not create this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">© TechShop — AI Tech Shop</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

module.exports = { accountVerificationTemplate };
