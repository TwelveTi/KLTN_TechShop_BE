const advisor = require("./advisor");
const comparison = require("./comparison");

// Registry of AI agents, keyed by `AiConversation.conversationType`.
//
// One entry per agent so a new one is added by dropping a file next to
// `advisor.js` and listing it here — the service that drives the model does not
// change. `PRODUCT_COMPARISON` proved that out: nó dùng lại nguyên vòng gọi
// model, `guardrails` và hạ tầng fallback, chỉ khác prompt và tool khai báo.
//
// Mỗi agent phải khai `toolNames`; service chỉ đưa cho model đúng những tool đó.

const agents = {
  [advisor.conversationType]: advisor,
  [comparison.conversationType]: comparison,
};

const getAgent = (conversationType) => {
  const agent = agents[conversationType];

  if (!agent) {
    throw new Error(`No AI prompt registered for conversationType "${conversationType}"`);
  }

  return agent;
};

module.exports = { agents, getAgent };
