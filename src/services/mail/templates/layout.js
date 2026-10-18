// Khung chung cho mọi email, lấy màu, chữ, bo góc từ token của FE (FE/techshop-frontend/src/index.css)
// để thư nhìn giống giao diện web. Email không đọc được CSS biến nên mã màu phải ghi thẳng ở đây.

const COLOR = {
  bg: "#f6f8fb", // neutral-50
  surface: "#ffffff", // neutral-0
  sunken: "#f6f8fb",
  border: "#e2e7ef", // neutral-200
  heading: "#111827", // neutral-900
  text: "#4b5563", // neutral-600
  muted: "#6b7688", // neutral-500
  primary: "#2563eb", // brand-600
  primarySoft: "#eff5ff", // brand-50
};

const FONT = {
  display: "'Be Vietnam Pro','Segoe UI',system-ui,-apple-system,Arial,sans-serif",
  body: "Inter,system-ui,-apple-system,'Segoe UI',Arial,sans-serif",
  mono: "'JetBrains Mono',Consolas,'Courier New',monospace",
};

// Họ tên do người dùng tự nhập, phải thoát ký tự HTML trước khi chèn vào thư.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Nút chính, cùng kiểu Button variant="primary" trên web: nền xanh phẳng, bo 8px.
function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;">
  <tr>
    <td style="border-radius:8px;background-color:${COLOR.primary};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT.body};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function layout({ title, preheader, body, footnote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.bg};font-family:${FONT.body};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:12px;">
          <tr>
            <td style="padding:20px 32px;border-bottom:1px solid ${COLOR.border};">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:32px;height:32px;border-radius:8px;background-color:${COLOR.primary};text-align:center;vertical-align:middle;font-family:${FONT.display};font-size:13px;font-weight:700;color:#ffffff;">TS</td>
                  <td style="padding-left:10px;font-family:${FONT.display};font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${COLOR.heading};">TechShop</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
              <p style="margin:0;padding-top:20px;border-top:1px solid ${COLOR.border};font-size:13px;line-height:1.5;color:${COLOR.muted};">${footnote}</p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${COLOR.muted};">TechShop · A tech store with an AI advisor that reads the real specifications in stock.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const styles = {
  h1: `margin:0 0 12px;font-family:${FONT.display};font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${COLOR.heading};`,
  p: `margin:0 0 20px;font-size:15px;line-height:1.6;color:${COLOR.text};`,
  small: `margin:0 0 24px;font-size:13px;line-height:1.5;color:${COLOR.muted};word-break:break-all;`,
  link: `color:${COLOR.primary};text-decoration:underline;`,
  code: `display:inline-block;padding:14px 28px;border:1px solid ${COLOR.border};border-radius:8px;background-color:${COLOR.primarySoft};font-family:${FONT.mono};font-size:30px;font-weight:600;letter-spacing:8px;color:${COLOR.heading};`,
};

module.exports = { layout, button, escapeHtml, styles };
