// Returns the subject / html / text for the password reset OTP email.
// Matches the TechShop brand palette (primary #2563EB). Contains only the OTP,
// its expiration and a security notice — never the password or account data.
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
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">Password reset code</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4B5563;">
                Hi ${safeName}, we received a request to reset your TechShop password. Use the verification code below to continue.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#F1F5F9;border:1px dashed #2563EB;padding:18px 32px;">
                    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563EB;">${code}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4B5563;">
                This code expires in <strong>${minutes} minutes</strong>.
              </p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9CA3AF;">
                If you did not request a password reset, you can safely ignore this email — your password will remain unchanged. For your security, never share this code with anyone.
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

module.exports = { passwordResetTemplate };
