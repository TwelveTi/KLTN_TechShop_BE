const crypto = require("crypto");
const vnpayConfig = require("../configs/vnpayConfig");

// VNPay 2.1.0 checksum rules, implemented once so the URL builder and the
// return/IPN verifier can never disagree about them:
//
//   1. drop vnp_SecureHash and vnp_SecureHashType
//   2. drop empty values (the gateway does not sign them either)
//   3. sort the remaining keys ascending
//   4. url-encode key and value, encoding a space as "+"
//   5. join as "key=value&..." and HMAC-SHA512 with the merchant secret
//
// Step 4 is the usual source of "invalid checksum": the signed string and the
// query string actually sent must be byte-identical, so both are produced from
// buildQueryString below.

const encodeComponent = (value) => encodeURIComponent(String(value)).replace(/%20/g, "+");

const isPresent = (value) => value !== undefined && value !== null && value !== "";

const signableEntries = (params) =>
  Object.keys(params)
    .filter((key) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType")
    .filter((key) => isPresent(params[key]))
    .sort()
    .map((key) => [key, params[key]]);

const buildQueryString = (params) =>
  signableEntries(params)
    .map(([key, value]) => `${encodeComponent(key)}=${encodeComponent(value)}`)
    .join("&");

const sign = (params, secret = vnpayConfig.HASH_SECRET) =>
  crypto
    .createHmac(vnpayConfig.HASH_ALGORITHM, secret)
    .update(Buffer.from(buildQueryString(params), "utf-8"))
    .digest("hex");

// Constant-time compare so a malicious caller cannot probe the secret by
// timing how long a wrong hash takes to reject.
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a).toLowerCase(), "utf-8");
  const right = Buffer.from(String(b).toLowerCase(), "utf-8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const verifySignature = (params) => {
  const received = params?.vnp_SecureHash;

  if (!isPresent(received)) {
    return false;
  }

  return safeEqual(received, sign(params));
};

// yyyyMMddHHmmss rendered in the gateway's timezone (GMT+7), independent of
// whatever timezone the server happens to run in.
const formatDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: vnpayConfig.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
};

// VNPay rejects IPv6 forms such as "::1" (what Express reports on localhost)
// and only accepts a dotted IPv4 address.
const normalizeIp = (ip) => {
  if (!ip) {
    return "127.0.0.1";
  }

  const value = String(ip);

  if (value === "::1" || value === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }

  if (value.startsWith("::ffff:")) {
    return value.slice("::ffff:".length);
  }

  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) ? value : "127.0.0.1";
};

// vnp_OrderInfo travels through the signed query string; keeping it to plain
// ASCII avoids encoding mismatches between our hash and the gateway's.
const DIACRITIC_MARKS = new RegExp(String.fromCharCode(91, 92, 117, 48, 51, 48, 48, 45, 92, 117, 48, 51, 54, 102, 93), "g");
const D_LOWER = String.fromCharCode(273);
const D_UPPER = String.fromCharCode(272);

const sanitizeOrderInfo = (text) =>
  String(text)
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, "")
    .split(D_LOWER)
    .join("d")
    .split(D_UPPER)
    .join("D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);

const buildPaymentUrl = (params) => {
  const query = buildQueryString(params);
  const secureHash = sign(params);

  return `${vnpayConfig.PAY_URL}?${query}&vnp_SecureHash=${secureHash}`;
};

module.exports = {
  buildQueryString,
  sign,
  verifySignature,
  formatDate,
  normalizeIp,
  sanitizeOrderInfo,
  buildPaymentUrl,
};
