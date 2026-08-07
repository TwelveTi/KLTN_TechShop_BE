// Detect disposable / throwaway ("spam signup") email domains using an offline
// domain list — no external API call. Falls back to a small built-in list if the
// package is not installed.
let disposableSet;

try {
  const domains = require("disposable-email-domains"); // array of domains
  disposableSet = new Set(domains);
} catch {
  disposableSet = new Set([
    "mailinator.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "tempmail.com",
    "temp-mail.org",
    "trashmail.com",
    "getnada.com",
    "sharklasers.com",
    "dispostable.com",
    "throwawaymail.com",
    "fakeinbox.com",
  ]);
}

function getEmailDomain(email) {
  const at = String(email || "").lastIndexOf("@");
  if (at === -1) {
    return "";
  }
  return email
    .slice(at + 1)
    .toLowerCase()
    .trim();
}

function isDisposableEmail(email) {
  const domain = getEmailDomain(email);
  return Boolean(domain) && disposableSet.has(domain);
}

module.exports = { isDisposableEmail, getEmailDomain };
