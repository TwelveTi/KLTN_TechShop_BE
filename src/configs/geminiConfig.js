const { GoogleGenAI } = require("@google/genai");

// The advisor is optional infrastructure. The shop must boot and serve every
// other route with no API key present, so nothing is constructed at require
// time: `isConfigured()` is what lets the route answer 503 instead of the
// process dying on startup in an environment that simply has no key.

const num = (raw, fallback) => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

// Pinned to an exact version on purpose. `gemini-flash-latest` also resolves,
// but it moves: a thesis that reports measured answers cannot have the model
// change under it between the evaluation chapter and the defence. Google's
// migration notice points new keys at 3.6 (2.5-flash is closed to them), and
// 3.7 / 3.8 exist if a later comparison is wanted.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Deliberately cold. This model explains a list the database already chose; it
// is not being asked to write. Warmth here shows up as embellished specs —
// exactly the failure mode 7.0.1 exists to prevent.
const TEMPERATURE = num(process.env.GEMINI_TEMPERATURE, 0.2);

// Gemini 3 thinks before it answers, and those thoughts are spent from this
// same budget — a measured 200 thinking tokens to answer "2+2". At 1024 the
// advisor reasoned its way through a tool result and then had nothing left to
// say with, returning an empty string that reads exactly like a broken model.
// The headroom is the fix; `THINKING_LEVEL` is what keeps it from being needed.
const MAX_OUTPUT_TOKENS = num(process.env.GEMINI_MAX_OUTPUT_TOKENS, 4096);

// This assistant turns a filtered list into two sentences of explanation. That
// is not a reasoning problem, and paying HIGH for it buys latency and output
// tokens rather than a better answer.
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "LOW";

// One turn to call the search tool, one more to refine it after seeing the
// result. Past that the model is guessing at filters, and every extra turn is a
// billed round trip the shopper waits through.
const MAX_TOOL_TURNS = num(process.env.GEMINI_MAX_TOOL_TURNS, 3);

/**
 * Chuỗi model dự phòng, thử theo thứ tự khi model chính không dùng được.
 *
 * Hạn mức của Gemini tính RIÊNG TỪNG MODEL (`...PerProjectPerModel-FreeTier`),
 * nên hết lượt `gemini-3.6-flash` không ảnh hưởng gì tới `gemini-3.7-flash`.
 * Ba model là 60 request/ngày thay vì 20, không tốn một dòng tích hợp nào —
 * cùng SDK, cùng cấu trúc function calling, cùng `thinkingLevel`.
 *
 * Để trống biến này là TẮT hẳn fallback. Cần thiết khi đo đạc cho luận văn:
 * lúc đó phải chắc mọi câu chạy trên đúng một model, nếu không số đo là số của
 * một hỗn hợp không tái lập được.
 */
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.7-flash,gemini-3.8-flash")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/**
 * Model nào đang nghỉ, tới lúc nào (epoch ms).
 *
 * Không có bảng này thì mỗi câu hỏi lại đốt một request để phát hiện lại điều
 * đã biết từ câu trước — với hạn mức 20/ngày thì đó là lãng phí thấy rõ.
 *
 * Nằm trong bộ nhớ tiến trình là đủ: mất khi restart thì cùng lắm tốn một
 * request để học lại, và một bảng trong DB cho việc này là hạ tầng thừa.
 */
const cooldownUntil = new Map();

const COOLDOWN_MS = {
  // Hạn mức NGÀY — thử lại sau 30 phút, đủ để bắt được lúc sang ngày mới mà
  // không phải tính múi giờ reset của Google.
  quotaDaily: 30 * 60 * 1000,
  // Hạn mức PHÚT — vài chục giây là qua.
  quotaMinute: 60 * 1000,
  // Model bị đổi tên hoặc khoá với key này: gần như không tự hồi, nhưng vẫn đặt
  // hạn để một lần cấu hình sai không làm chết model đó tới hết đời tiến trình.
  modelMissing: 60 * 60 * 1000,
  // Quá tải phía Google: thoáng qua, nghỉ ngắn rồi thử lại. Nghỉ lâu ở đây là
  // tự bỏ model chính hàng giờ vì một cơn tắc nghẽn vài phút.
  overloaded: 2 * 60 * 1000,
};

/**
 * Lỗi của Gemini nói gì, và có đáng thử model khác không.
 *
 * SDK ném lỗi với `message` là nguyên văn JSON của Google nên phải đọc từ chuỗi.
 * Đặt ở đây chứ không ở service vì đây là kiến thức về NHÀ CUNG CẤP: service chỉ
 * cần biết "thử tiếp hay dừng".
 */
const classifyError = (error) => {
  const raw = String(error?.message || "");

  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes('"code":429')) {
    const isDaily = raw.includes("PerDay") || raw.includes("per_day");
    return { kind: isDaily ? "quotaDaily" : "quotaMinute", tryNextModel: true };
  }

  if (raw.includes('"code":404') || raw.includes("NOT_FOUND")) {
    return { kind: "modelMissing", tryNextModel: true };
  }

  // Model quá tải phía Google — 503 UNAVAILABLE hoặc 500 INTERNAL.
  //
  // Đây chính là ca mà fallback tồn tại để xử lý, và cũng là ca gặp thật ngay
  // trong buổi kiểm thử: `gemini-3.7-flash` trả "experiencing high demand" giữa
  // chừng. Nó thoáng qua và độc lập giữa các model, nên chuyển sang model khác
  // gần như luôn thành công ngay.
  if (
    raw.includes("UNAVAILABLE") ||
    raw.includes('"code":503') ||
    raw.includes('"code":500') ||
    raw.includes("INTERNAL")
  ) {
    return { kind: "overloaded", tryNextModel: true };
  }

  // Sai khoá thì mọi model đều sai như nhau — thử tiếp chỉ tốn thời gian và làm
  // lỗi thật bị chôn dưới một chuỗi thất bại trông như vấn đề hạn mức.
  //
  // `API_KEY_INVALID` phải có trong danh sách này: Google trả nó kèm **400**,
  // không phải 401/403. Thiếu nó thì khoá sai rơi vào nhánh "lỗi lạ", không dịch
  // được, và nguyên khối JSON của Google lọt ra client dưới dạng 500 — đã gặp
  // thật lúc kiểm thử.
  if (
    raw.includes("API_KEY_INVALID") ||
    raw.includes('"code":401') ||
    raw.includes('"code":403') ||
    raw.includes("PERMISSION_DENIED")
  ) {
    return { kind: "auth", tryNextModel: false };
  }

  return { kind: "other", tryNextModel: false };
};

/** Đánh dấu một model tạm thời không dùng được. */
const markCooldown = (model, kind) => {
  const duration = COOLDOWN_MS[kind];
  if (duration) cooldownUntil.set(model, Date.now() + duration);
};

/**
 * Các model nên thử, theo thứ tự ưu tiên, đã loại những model đang nghỉ.
 *
 * Nếu TẤT CẢ đang nghỉ thì trả về nguyên chuỗi thay vì mảng rỗng: thà thử và
 * nhận lỗi thật từ Google còn hơn tự báo lỗi dựa trên một bảng trong bộ nhớ có
 * thể đã cũ.
 */
const resolveModelChain = () => {
  const chain = [MODEL, ...FALLBACK_MODELS.filter((name) => name !== MODEL)];
  const now = Date.now();
  const available = chain.filter((name) => (cooldownUntil.get(name) ?? 0) <= now);

  return available.length > 0 ? available : chain;
};

/** Chỉ dùng cho test — xoá trạng thái nghỉ giữa các ca kiểm. */
const resetCooldowns = () => cooldownUntil.clear();

let client = null;

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const getClient = () => {
  if (!isConfigured()) {
    return null;
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return client;
};

module.exports = {
  MODEL,
  FALLBACK_MODELS,
  TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  THINKING_LEVEL,
  MAX_TOOL_TURNS,
  isConfigured,
  getClient,
  classifyError,
  markCooldown,
  resolveModelChain,
  resetCooldowns,
};
