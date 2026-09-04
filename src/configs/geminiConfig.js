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
  TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  THINKING_LEVEL,
  MAX_TOOL_TURNS,
  isConfigured,
  getClient,
};
