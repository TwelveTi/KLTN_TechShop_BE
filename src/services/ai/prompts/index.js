const advisor = require("./advisor");

// Registry of AI agents, keyed by `AiConversation.conversationType`.
//
// One entry per agent so a new one is added by dropping a file next to
// `advisor.js` and listing it here — the service that drives the model does not
// change. `PRODUCT_COMPARISON` reuses the advisor's tool and differs only in its
// prompt, which is exactly the split this registry is shaped for.

const agents = {
  [advisor.conversationType]: advisor,
};

const getAgent = (conversationType) => {
  const agent = agents[conversationType];

  if (!agent) {
    throw new Error(`No AI prompt registered for conversationType "${conversationType}"`);
  }

  return agent;
};

module.exports = { agents, getAgent };
