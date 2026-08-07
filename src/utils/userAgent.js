// Lightweight User-Agent parser (no dependency) — good enough to label a
// session/device in the account "active sessions" screen.
function parseUserAgent(ua) {
  if (!ua || typeof ua !== "string") {
    return { label: "Unknown device", browser: "Unknown", os: "Unknown", deviceType: "unknown" };
  }

  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Linux/.test(ua)) os = "Linux";

  // Order matters: Edge/Opera identify themselves as Chrome too.
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Version\/.*Safari/.test(ua)) browser = "Safari";
  else if (/curl|PostmanRuntime|node|axios|insomnia/i.test(ua)) browser = ua.split("/")[0];

  let deviceType = "desktop";
  if (/iPad|Tablet/.test(ua)) deviceType = "tablet";
  else if (/Mobile|iPhone|Android.*Mobile/.test(ua)) deviceType = "mobile";

  let label;
  if (browser !== "Unknown" && os !== "Unknown") label = `${browser} on ${os}`;
  else if (browser !== "Unknown") label = browser;
  else if (os !== "Unknown") label = os;
  else label = ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;

  return { label, browser, os, deviceType };
}

module.exports = { parseUserAgent };
