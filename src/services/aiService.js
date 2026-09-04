const { Type } = require("@google/genai");

const aiRepository = require("../repositories/aiRepository");
const { getAgent } = require("./ai/prompts");
const {
  MODEL,
  TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  THINKING_LEVEL,
  MAX_TOOL_TURNS,
  isConfigured,
  getClient,
} = require("../configs/geminiConfig");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// AI Product Advisor.
//
// The whole design follows one rule from BE README 7.0.1: the model never
// answers a product question from what it knows. It extracts constraints, the
// database answers them, and the model is only allowed to explain the rows it
// was handed back.
//
// Two things enforce that, and they are worth naming because the prompt alone
// would not:
//
//   1. The catalogue reaches the model exclusively as a tool result. There is
//      no product data in the system instruction, so there is nothing to
//      paraphrase from.
//   2. The `products` array this service returns to the client is the tool's
//      output, never a parse of the model's prose. If the model does invent a
//      laptop, its name appears in the explanation but no card renders for it,
//      and the mismatch is visible in `ai_recommended_products` instead of
//      shipping to the shopper as a real listing.
//
// A prompt can be talked around. A response assembled from query rows cannot.

const SEARCH_PRODUCTS_TOOL = {
  name: "search_products",
  description:
    "Search the shop's real catalogue. Call this before answering ANY question about products, " +
    "prices or specifications. Never state a product name, price or specification that did not " +
    "come back from this tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categorySlug: {
        type: Type.STRING,
        description: "Category slug from the catalogue list in the system instruction. Omit to search every category.",
      },
      brandNames: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Brand names exactly as listed in the system instruction.",
      },
      minPrice: { type: Type.NUMBER, description: "Minimum price in VND (absolute, not millions)." },
      maxPrice: { type: Type.NUMBER, description: "Maximum price in VND (absolute, not millions)." },
      specFilters: {
        type: Type.ARRAY,
        description:
          "Specification constraints. Only use spec keys listed under the chosen category. " +
          "Use gte/lte/eq for NUMBER specs and contains for STRING specs.",
        items: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING },
            op: { type: Type.STRING, enum: ["gte", "lte", "eq", "contains"] },
            value: {
              type: Type.STRING,
              description: "A number for gte/lte/eq (in the spec's unit), or a substring for contains.",
            },
          },
          required: ["key", "op", "value"],
        },
      },
      inStockOnly: { type: Type.BOOLEAN, description: "Only products currently in stock." },
      sortBy: {
        type: Type.STRING,
        enum: ["relevance", "priceAsc", "priceDesc", "rating", "bestSelling"],
      },
      limit: { type: Type.INTEGER, description: "How many products to return, 1-12. Default 8." },
    },
  },
};

// How much prior conversation is replayed. Two ceilings rather than one: the
// row cap bounds the query, the character cap bounds the bill. Twenty turns of
// 1000-character questions would be roughly 7k tokens resent on every request,
// growing for the length of the thread — a cost that compounds silently because
// nothing about it looks wrong in a single response.
//
// Trimming keeps the NEWEST turns: in a shopping conversation the last exchange
// carries the constraint being refined ("rẻ hơn chút nữa"), and the opening
// question is the part the model can most afford to forget.
const HISTORY_MAX_MESSAGES = 20;
const HISTORY_MAX_CHARS = 6000;

// The vocabulary changes only when an admin edits the catalogue taxonomy, but it
// is sent on every request. Caching it keeps a chat turn to one round trip
// instead of a query the answer never depends on.
const VOCABULARY_TTL_MS = 5 * 60 * 1000;
let vocabularyCache = { value: null, expiresAt: 0 };

const loadVocabulary = async () => {
  const now = Date.now();

  if (!vocabularyCache.value || vocabularyCache.expiresAt < now) {
    vocabularyCache = {
      value: await aiRepository.findFilterVocabulary(),
      expiresAt: now + VOCABULARY_TTL_MS,
    };
  }

  return vocabularyCache.value;
};

class AiService {
  /**
   * One advisor turn.
   *
   * Returns the assistant's explanation plus the products the database actually
   * returned, so the client renders cards from query rows and only the prose
   * comes from the model.
   */
  async ask({ userId = null, sessionId = null, conversationId = null, message }) {
    if (!isConfigured()) {
      throw new AppError("AI advisor is not configured on this server", 503);
    }

    const conversation = await this.resolveConversation({ userId, sessionId, conversationId, message });
    const history = trimHistory(
      await aiRepository.findMessages(conversation.id, { limit: HISTORY_MAX_MESSAGES }),
    );

    const contents = history.map((row) => ({
      role: row.role === "ASSISTANT" ? "model" : "user",
      parts: [{ text: row.content }],
    }));
    contents.push({ role: "user", parts: [{ text: message }] });

    const userMessage = await aiRepository.createMessage({
      conversationId: conversation.id,
      role: "USER",
      content: message,
    });

    const { answer, products, toolCalls, usage } = await this.runToolLoop({
      contents,
      conversationId: conversation.id,
      conversationType: conversation.conversationType,
    });

    const assistantMessage = await aiRepository.createMessage({
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: answer,
      // The product ids are stored beside the text so a later evaluation can ask
      // what the answer was built from without re-parsing Vietnamese prose.
      structuredData: { productIds: products.map((product) => product.id), toolCalls },
      modelName: MODEL,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    });

    await aiRepository.linkRecommendedProducts(assistantMessage.id, products);

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      userMessageId: userMessage.id,
      answer,
      products,
      // Surfaced so the thesis can show the grounding actually happened, and so
      // an answer with no query behind it is visible rather than assumed.
      grounding: {
        toolCalls,
        productCount: products.length,
      },
    };
  }

  /**
   * Continues an existing thread or opens a new one.
   *
   * The ownership check is the point: conversation ids are UUIDs in a request
   * body, so without it anyone holding an id could read a stranger's chat. A
   * signed-in shopper owns their conversations by `userId`; a guest owns theirs
   * by the session key the behaviour tracker already issues.
   */
  async resolveConversation({ userId, sessionId, conversationId, message }) {
    if (conversationId) {
      const existing = await aiRepository.findConversation(conversationId);

      if (!existing) {
        throw new AppError("Conversation not found", 404);
      }

      const ownedByUser = userId && existing.userId === userId;
      const ownedBySession = !existing.userId && sessionId && existing.sessionId === sessionId;

      if (!ownedByUser && !ownedBySession) {
        throw new AppError("Conversation not found", 404);
      }

      if (existing.status === "CLOSED") {
        throw new AppError("Conversation is closed", 409);
      }

      return existing;
    }

    return aiRepository.createConversation({
      userId,
      sessionId,
      conversationType: "PRODUCT_ADVISOR",
      // First question doubles as the thread title — enough to tell threads
      // apart in an admin list without a second model call to summarise them.
      title: message.slice(0, 120),
    });
  }

  /**
   * Drives the model until it stops asking for data.
   *
   * The loop is bounded twice over. `MAX_TOOL_TURNS` caps the round trips, and
   * when that cap is reached the final call goes out with no tools at all, so
   * the shopper always gets prose instead of a turn that silently ends on an
   * unanswered tool call.
   */
  async runToolLoop({ contents, conversationId, conversationType }) {
    const client = getClient();
    const agent = getAgent(conversationType);
    const systemInstruction = agent.buildSystemInstruction(await loadVocabulary());

    const baseConfig = {
      systemInstruction,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: THINKING_LEVEL },
    };

    let products = [];
    const toolCalls = [];
    const usage = { promptTokens: 0, completionTokens: 0 };
    let turn = 0;

    while (true) {
      const toolsExhausted = turn >= MAX_TOOL_TURNS;

      const response = await client.models.generateContent({
        model: MODEL,
        contents,
        config: toolsExhausted
          ? baseConfig
          : { ...baseConfig, tools: [{ functionDeclarations: [SEARCH_PRODUCTS_TOOL] }] },
      });

      usage.promptTokens += response.usageMetadata?.promptTokenCount || 0;
      // Thinking tokens are reported separately but billed as output, and on
      // Gemini 3 they routinely outnumber the visible answer. Counting only
      // `candidatesTokenCount` would put a number in the database that looks
      // like a cost and is not one.
      usage.completionTokens +=
        (response.usageMetadata?.candidatesTokenCount || 0) +
        (response.usageMetadata?.thoughtsTokenCount || 0);

      const calls = response.functionCalls || [];

      if (calls.length === 0 || toolsExhausted) {
        return {
          answer: response.text || "Xin lỗi, hiện tại tôi chưa trả lời được câu hỏi này.",
          products,
          toolCalls,
          usage,
        };
      }

      // The model's own turn is echoed back verbatim rather than rebuilt from
      // `functionCalls`, because the candidate content carries fields (thought
      // signatures among them) that the next request must see unchanged.
      const modelTurn = response.candidates?.[0]?.content;
      contents.push(modelTurn || { role: "model", parts: calls.map((call) => ({ functionCall: call })) });

      const responseParts = [];

      for (const call of calls) {
        const result = await this.runTool(call, conversationId);
        products = result.products.length > 0 ? result.products : products;
        toolCalls.push({ name: call.name, args: call.args || {}, resultCount: result.products.length });

        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: result.payload,
          },
        });
      }

      contents.push({ role: "user", parts: responseParts });
      turn += 1;
    }
  }

  /** Executes one tool call and persists it as a TOOL message. */
  async runTool(call, conversationId) {
    if (call.name !== SEARCH_PRODUCTS_TOOL.name) {
      return {
        products: [],
        payload: { error: `Unknown tool "${call.name}"` },
      };
    }

    const args = normaliseSearchArgs(call.args || {});

    let products = [];
    let payload;

    try {
      products = await aiRepository.searchProducts(args);
      payload = {
        // Named `products` rather than returned bare so a zero-result search
        // reads as an explicit empty list. The model treats a missing key as an
        // error and retries; an empty array is an answer.
        products: products.map(toModelView),
        count: products.length,
      };
    } catch (error) {
      logger.error("AI advisor tool call failed", {
        tool: call.name,
        args,
        error: logger.serializeError(error),
      });
      payload = { error: "Product search failed", products: [], count: 0 };
    }

    await aiRepository.createMessage({
      conversationId,
      role: "TOOL",
      content: JSON.stringify(args),
      structuredData: {
        tool: call.name,
        args,
        productIds: products.map((product) => product.id),
      },
    });

    return { products, payload };
  }
}

// ── Context budget ──────────────────────────────────────────────────────────

/**
 * Drops the oldest turns until the replayed history fits its character budget.
 *
 * Walking from the newest backwards is what makes the cut safe: the turn a
 * follow-up question depends on is always the last one, never the first.
 */
const trimHistory = (messages) => {
  const kept = [];
  let budget = HISTORY_MAX_CHARS;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const size = messages[index].content.length;

    if (size > budget) {
      break;
    }

    budget -= size;
    kept.unshift(messages[index]);
  }

  return kept;
};

/**
 * What the model is shown for each product — deliberately less than the client
 * gets back.
 *
 * Two reasons to keep these views apart. Tokens: ids, slugs and image URLs are
 * pure cost, and with twelve products they are a meaningful share of the
 * request. Behaviour: a model that never sees a URL cannot paste one into an
 * answer, and the storefront builds its links from the database rows anyway.
 *
 * `shortDescription` is truncated because it is marketing copy written for a
 * product page, not for a model deciding whether something fits a budget.
 */
const toModelView = (product) => ({
  name: product.name,
  brand: product.brand?.name || null,
  category: product.category?.name || null,
  price: product.price,
  onSale: product.salePrice !== null,
  inStock: product.inStock,
  rating: product.averageRating,
  reviewCount: product.reviewCount,
  summary: product.shortDescription ? product.shortDescription.slice(0, 160) : null,
  specs: Object.entries(product.specs).reduce((acc, [key, spec]) => {
    acc[key] = spec.unit ? `${spec.value} (${spec.unit})` : spec.value;
    return acc;
  }, {}),
});

// ── Argument hygiene ────────────────────────────────────────────────────────

/**
 * The model's arguments are input, not instructions.
 *
 * Two failures are worth the guard. It routinely sends prices in millions
 * ("20" for 20 triệu) because that is how the question was phrased, and it will
 * ask for a limit of 50 when the prompt says 12. Both are cheap to correct here
 * and expensive to notice in an answer.
 */
const normaliseSearchArgs = (args) => {
  const toNumber = (raw) => {
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  // Anything under a million as a VND price is a unit mistake, not a real
  // budget — the cheapest thing this shop sells is well above it.
  const toVnd = (raw) => {
    const value = toNumber(raw);
    if (value === null) {
      return null;
    }
    return value > 0 && value < 1000 ? value * 1_000_000 : value;
  };

  const limit = toNumber(args.limit);

  return {
    categorySlug: typeof args.categorySlug === "string" && args.categorySlug ? args.categorySlug : null,
    brandNames: Array.isArray(args.brandNames) ? args.brandNames.filter((name) => typeof name === "string") : [],
    minPrice: toVnd(args.minPrice),
    maxPrice: toVnd(args.maxPrice),
    specFilters: Array.isArray(args.specFilters)
      ? args.specFilters
          .filter((filter) => filter && typeof filter.key === "string" && typeof filter.op === "string")
          .map((filter) => ({ key: filter.key, op: filter.op, value: filter.value }))
      : [],
    inStockOnly: args.inStockOnly === true,
    sortBy: typeof args.sortBy === "string" ? args.sortBy : "relevance",
    limit: limit === null ? 8 : Math.min(Math.max(Math.trunc(limit), 1), 12),
  };
};

module.exports = new AiService();
