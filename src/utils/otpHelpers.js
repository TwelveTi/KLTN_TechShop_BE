// Small time/policy calculations for the OTP flow. Extracted from the service
// so the "how long until X" math is pure and testable.
const { OTP_RESEND_COOLDOWN_SECONDS } = require("../configs/passwordConfig");

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

const secondsElapsedSince = (date) => (Date.now() - new Date(date).getTime()) / 1000;

// Seconds the caller must still wait before another OTP may be issued, based on
// the most recent OTP record's creation time. 0 means "may issue now".
const resendRetryAfterSeconds = (record) => {
  if (!record) {
    return 0;
  }
  const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsElapsedSince(record.createdAt));
  return remaining > 0 ? remaining : 0;
};

module.exports = {
  minutesFromNow,
  secondsElapsedSince,
  resendRetryAfterSeconds,
};
