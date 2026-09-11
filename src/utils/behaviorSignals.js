// The tracked event vocabulary and how much each event says about intent.
//
// Shared by behaviorService (which folds events into a preference profile) and
// behaviorValidation (which guards the client-facing endpoint), so the two can
// never drift apart. Same reasoning as utils/pricing.
//
// BEHAVIOR_TYPES must stay in sync with the ENUM on UserBehavior.behaviorType.
const BEHAVIOR_TYPES = [
  "SEARCH",
  "VIEW_PRODUCT",
  "ADD_TO_CART",
  "PURCHASE",
  "FAVORITE",
  "REVIEW",
  "CLICK_RECOMMENDATION",
];

// Buying something means far more than glancing at it. These weights are the
// one place to tune how the profile reads the event log.
const SIGNAL_WEIGHTS = {
  PURCHASE: 10,
  ADD_TO_CART: 5,
  FAVORITE: 4,
  REVIEW: 3,
  CLICK_RECOMMENDATION: 2,
  VIEW_PRODUCT: 1,
  SEARCH: 1,
};

// Events a client is allowed to report. Everything else the backend observes
// itself, where it cannot be forged by a caller inflating their own signals.
const CLIENT_REPORTABLE_TYPES = ["CLICK_RECOMMENDATION", "FAVORITE"];

// Suy giảm theo thời gian: tín hiệu càng cũ càng nói ít về nhu cầu hôm nay.
// Lý do chọn nửa chu kỳ và sàn, kèm số đo, ở README 6.2.1.
const numberFromEnv = (name, fallback) => {
  const raw = process.env[name];

  if (raw === undefined || String(raw).trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

// `PROFILE_DECAY_HALF_LIFE_DAYS=0` tắt hẳn suy giảm — dùng làm nhóm đối chứng
// khi đo.
const DECAY_HALF_LIFE_DAYS = numberFromEnv("PROFILE_DECAY_HALF_LIFE_DAYS", 60);
const DECAY_FLOOR = numberFromEnv("PROFILE_DECAY_FLOOR", 0.35);

// Sàn giữ thứ tự sức mạnh của tín hiệu: một lượt xem hôm nay không được lật
// một lượt cho vào giỏ của tháng trước.
function decayFactor(daysAgo) {
  if (!(daysAgo > 0) || DECAY_HALF_LIFE_DAYS <= 0) {
    return 1;
  }

  return Math.max(DECAY_FLOOR, 0.5 ** (daysAgo / DECAY_HALF_LIFE_DAYS));
}

// Trọng số tín hiệu đã nhân hệ số suy giảm — thứ mà profile thật sự cộng.
function effectiveWeight(behaviorType, daysAgo = 0) {
  return (SIGNAL_WEIGHTS[behaviorType] || 1) * decayFactor(daysAgo);
}

module.exports = {
  BEHAVIOR_TYPES,
  SIGNAL_WEIGHTS,
  CLIENT_REPORTABLE_TYPES,
  DECAY_HALF_LIFE_DAYS,
  DECAY_FLOOR,
  decayFactor,
  effectiveWeight,
};
