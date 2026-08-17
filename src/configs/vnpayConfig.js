// Centralised, env-driven configuration for the VNPay payment gateway.
// Kept out of the service so credentials/endpoints live in one place and the
// sandbox -> production switch is a .env change, not a code change.
require("dotenv").config();

// .env in this project is written as `KEY =value`, so values arrive with a
// leading space. Trim every read instead of relying on the file formatting.
const readEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const stripTrailingSlash = (url) => url.replace(/\/+$/, "");

const APP_URL = stripTrailingSlash(readEnv("APP_URL") || "http://localhost:3000");
const FRONTEND_URL = stripTrailingSlash(readEnv("FRONTEND_URL") || "http://localhost:5173");

const TMN_CODE = readEnv("vnp_TmnCode");
const HASH_SECRET = readEnv("vnp_HashSecret");

module.exports = {
  // Payment stays disabled (and the route can 503 instead of building a broken
  // signature) until both merchant credentials are present.
  ENABLED: Boolean(TMN_CODE && HASH_SECRET),

  // Merchant credentials from the VNPay merchant portal.
  TMN_CODE,
  HASH_SECRET,

  // Gateway the customer is redirected to in order to pay.
  PAY_URL:
    readEnv("vnp_Url") || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",

  // Merchant-side REST API (querydr / refund). Not used by the redirect flow,
  // but needed to reconcile an order whose return/IPN never arrived.
  API_URL:
    readEnv("vnp_Api") ||
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",

  // Browser redirect target after payment. Must point at the BACKEND so the
  // signature can be verified server-side; the handler then redirects the user
  // on to FRONTEND_RESULT_URL. This exact string is part of the signed payload,
  // so it has to match what is registered in the VNPay portal character for
  // character.
  RETURN_URL:
    readEnv("vnp_ReturnUrl") || `${APP_URL}/api/v1/payments/vnpay/return`,

  // Server-to-server callback. This is the authoritative confirmation: the
  // browser return can be abandoned, the IPN cannot.
  IPN_URL: readEnv("vnp_IpnUrl") || `${APP_URL}/api/v1/payments/vnpay/ipn`,

  // Where the backend sends the customer once the result is settled.
  FRONTEND_RESULT_URL: {
    SUCCESS: `${FRONTEND_URL}/checkout/success`,
    FAILED: `${FRONTEND_URL}/checkout/failed`,
  },

  // Protocol constants. Pinned here so the value never drifts between the
  // URL builder and the signature verifier.
  VERSION: "2.1.0",
  COMMAND: "pay",
  CURR_CODE: "VND",
  LOCALE: "vn",
  ORDER_TYPE: "other",
  HASH_ALGORITHM: "sha512",

  // VNPay expects the amount in the smallest unit: VND * 100.
  AMOUNT_MULTIPLIER: 100,

  // vnp_CreateDate / vnp_ExpireDate format, in GMT+7 (the gateway's timezone).
  DATE_FORMAT: "yyyyMMddHHmmss",
  TIMEZONE: "Asia/Ho_Chi_Minh",

  // How long the generated payment URL stays valid.
  EXPIRE_MINUTES: toPositiveInt(readEnv("vnp_ExpireMinutes"), 15),

  // Response/transaction codes the flow branches on. "00" is the only success
  // value; "24" is the customer pressing cancel, which is not an error.
  RESPONSE_CODE: {
    SUCCESS: "00",
    CANCELLED: "24",
  },

  // Body returned to VNPay's IPN call. It only stops retrying on a 200 with
  // RspCode "00", so these are part of the contract, not logging.
  IPN_RESPONSE: {
    SUCCESS: { RspCode: "00", Message: "Confirm Success" },
    INVALID_SIGNATURE: { RspCode: "97", Message: "Invalid Checksum" },
    ORDER_NOT_FOUND: { RspCode: "01", Message: "Order not found" },
    INVALID_AMOUNT: { RspCode: "04", Message: "Invalid amount" },
    ALREADY_CONFIRMED: { RspCode: "02", Message: "Order already confirmed" },
    UNKNOWN_ERROR: { RspCode: "99", Message: "Unknown error" },
  },
};
