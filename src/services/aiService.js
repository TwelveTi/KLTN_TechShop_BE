const { Type } = require("@google/genai");

const aiRepository = require("../repositories/aiRepository");
const recommendationRepository = require("../repositories/recommendationRepository");
const { getAgent } = require("./ai/prompts");
const explanationPrompt = require("./ai/prompts/explanation");
const {
  TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  THINKING_LEVEL,
  MAX_TOOL_TURNS,
  isConfigured,
  getClient,
  classifyError,
  markCooldown,
  resolveModelChain,
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
const FIND_BY_NAME_TOOL = {
  name: "find_products_by_name",
  description:
    "Tra sản phẩm theo TÊN mà người dùng nhắc tới. Dùng khi người dùng muốn so sánh những " +
    "sản phẩm cụ thể. Chỉ trả về sản phẩm có thật trong kho, kèm thông số để so sánh.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      names: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          "Tên sản phẩm như người dùng viết, mỗi phần tử một sản phẩm. Không cần chính xác tuyệt đối.",
      },
    },
    required: ["names"],
  },
};

/**
 * Tool khả dụng, tra theo tên.
 *
 * Mỗi agent tự khai dùng những tool nào (`toolNames`) thay vì service gắn cứng
 * một tool cho mọi agent. Advisor chỉ cần tìm theo ràng buộc; Comparison phải
 * tra theo tên trước rồi mới so được. Tách vậy nên thêm agent thứ ba là viết
 * thêm một file prompt, không phải sửa vòng lặp gọi model.
 */
const TOOLS = {
  [SEARCH_PRODUCTS_TOOL.name]: SEARCH_PRODUCTS_TOOL,
  [FIND_BY_NAME_TOOL.name]: FIND_BY_NAME_TOOL,
};

// question is the part the model can most afford to forget.
const HISTORY_MAX_MESSAGES = 20;
const HISTORY_MAX_CHARS = 6000;

// Trần cho mô tả dài đưa vào lời gọi so sánh. Mô tả sản phẩm là văn marketing:
// vài trăm chữ đầu mang gần hết thông tin, phần còn lại là điệp khúc bảo hành và
// chính sách đổi trả — thứ giống hệt nhau ở mọi sản phẩm nên không phân biệt
// được máy nào với máy nào.
const DESCRIPTION_MAX_CHARS = 900;

// Cửa sổ hành vi dùng làm bằng chứng cho lời giải thích. Ngắn hơn hẳn 90 ngày
// của bộ gợi ý: "bạn từng xem cái này ba tháng trước" không thuyết phục ai.
const EXPLANATION_WINDOW_DAYS = 30;

/** `["laptop", "phone"]` hoặc `[{name}]` → danh sách tên. Cột JSON nên phải phòng cả hai. */
const toNameList = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry : entry?.name || entry?.slug || null))
    .filter(Boolean)
    .slice(0, 4);
};

/** Tiền cho prompt: gọn, có đơn vị, không phụ thuộc locale của máy chủ. */
const formatVnd = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;

  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
};

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
  async ask({
    userId = null,
    sessionId = null,
    conversationId = null,
    message,
    conversationType = "PRODUCT_ADVISOR",
  }) {
    if (!isConfigured()) {
      throw new AppError("AI advisor is not configured on this server", 503);
    }

    const conversation = await this.resolveConversation({
      userId,
      sessionId,
      conversationId,
      message,
      conversationType,
    });
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

    const { answer, products, toolCalls, toolRecords, usage, model } = await this.runWithFallback(
      // Bản sao `contents` cho MỖI lần thử: vòng lặp đẩy thêm vào mảng này (lượt
      // của model, kết quả tool, câu nhắc trả lời). Dùng chung một mảng thì lần
      // thử trên model dự phòng bắt đầu từ đống rác của lần trước.
      (model) =>
        this.runToolLoop({
          contents: [...contents],
          conversationType: conversation.conversationType,
          model,
        }),
    );

    // Lưu lượng tool ghi TRƯỚC câu trả lời để thứ tự thời gian trong hội thoại
    // phản ánh đúng thứ tự đã xảy ra: hỏi → tra cứu → trả lời.
    for (const record of toolRecords) {
      await aiRepository.createMessage({ conversationId: conversation.id, ...record });
    }

    const assistantMessage = await aiRepository.createMessage({
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: answer,
      // The product ids are stored beside the text so a later evaluation can ask
      // what the answer was built from without re-parsing Vietnamese prose.
      structuredData: { productIds: products.map((product) => product.id), toolCalls },
      // Model THỰC SỰ đã trả lời, không phải model được cấu hình. Có fallback
      // rồi mà vẫn ghi hằng số là nói dối về chính phép chạy — và đây là cột
      // chương Đánh giá đọc để biết số đo thuộc về model nào.
      modelName: model,
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
        model,
      },
    };
  }

  /**
   * Chạy vòng tool trên model chính, rơi sang model dự phòng khi cần.
   *
   * Chạy lại NGUYÊN vòng chứ không đổi model giữa chừng. Lý do: một câu hỏi tốn
   * nhiều lượt `generateContent`, và `contents` tích luỹ function call cùng
   * `thoughtSignature` do model cũ sinh ra. Đưa đống đó cho một model khác là
   * trông chờ vào thứ không có gì bảo đảm. Chạy lại tốn thêm vài giây, đổi lại
   * mỗi câu trả lời được sinh trọn vẹn bởi đúng một model — cũng là điều kiện để
   * `modelName` ghi xuống có nghĩa.
   *
   * Chạy lại an toàn vì vòng lặp KHÔNG còn ghi gì xuống DB; `runTool` chỉ trả
   * bản ghi về cho `ask()` ghi một lượt sau cùng.
   */
  async runWithFallback(run) {
    const chain = resolveModelChain();
    let lastError = null;

    for (const model of chain) {
      try {
        return await run(model);
      } catch (error) {
        const { kind, tryNextModel } = classifyError(error);
        lastError = error;

        if (!tryNextModel) break;

        markCooldown(model, kind);
        logger.warn("Gemini model unavailable, trying next", {
          model,
          kind,
          remaining: chain.slice(chain.indexOf(model) + 1),
        });
      }
    }

    throw toAppError(lastError) || lastError;
  }

  /**
   * "Vì sao tôi được gợi ý sản phẩm này?"
   *
   * Không đi qua `AiConversation`: đây là câu hỏi về một `recommendationItem`
   * cụ thể, không phải một cuộc trò chuyện — và `conversationType` cũng không có
   * giá trị nào cho nó.
   *
   * **Kết quả được lưu lại.** Đây không phải tối ưu sớm mà là điều kiện để tính
   * năng dùng được: một rail 12 sản phẩm mà mỗi cái một lời gọi model thì riêng
   * việc mở trang chủ đã ăn hết hạn mức 20 request/ngày của free tier. Lưu vào
   * `reasonMetadata.explanation` — cột JSON có sẵn, không cần migration, và lời
   * giải thích nằm ngay cạnh chính dòng dữ liệu nó giải thích.
   */
  async explainRecommendation({ userId = null, sessionId = null, itemId }) {
    if (!isConfigured()) {
      throw new AppError("AI advisor is not configured on this server", 503);
    }

    const item = await recommendationRepository.findItemById(itemId);

    if (!item) {
      throw new AppError("Recommendation not found", 404);
    }

    // Chủ sở hữu xác định qua dòng `recommendation_results` cha, giống hệt cách
    // hội thoại làm: đã đăng nhập thì theo `userId`, khách vãng lai theo
    // `sessionId`. 404 chứ không 403 để endpoint không thành công cụ dò id.
    const owner = item.recommendation;
    const ownedByUser = userId && owner?.userId === userId;
    const ownedBySession = !owner?.userId && sessionId && owner?.sessionId === sessionId;

    if (!ownedByUser && !ownedBySession) {
      throw new AppError("Recommendation not found", 404);
    }

    const metadata = item.reasonMetadata || {};

    if (metadata.explanation) {
      return { itemId: item.id, explanation: metadata.explanation, cached: true };
    }

    const signals = await this.collectExplanationSignals({ userId, item });
    const cards = await recommendationRepository.findProductCards([item.productId]);
    const card = cards.get(item.productId);

    if (!card) {
      throw new AppError("Recommendation product no longer exists", 404);
    }

    const product = {
      name: card.name,
      category: card.category?.name || null,
      brand: card.brand?.name || null,
      price: formatVnd(card.salePrice ?? card.basePrice),
    };

    const { text, model } = await this.runWithFallback((candidate) =>
      this.generateText({
        model: candidate,
        system: explanationPrompt.SYSTEM,
        prompt: explanationPrompt.buildUserPrompt({
          product,
          dominant: metadata.dominant,
          signals,
        }),
      }),
    );

    const explanation = text.trim();

    await recommendationRepository.updateItem(item, {
      reasonMetadata: { ...metadata, explanation, explainedAt: new Date().toISOString(), model },
    });

    return { itemId: item.id, explanation, cached: false, model };
  }

  /**
   * Bằng chứng đưa vào lời giải thích.
   *
   * Chỉ lấy tín hiệu của CHÍNH khách này. Khách vãng lai không có `userId` nên
   * không có hồ sơ lẫn lịch sử tìm kiếm — lúc đó lời giải thích rút về "sản phẩm
   * đang bán chạy", và đó là câu trả lời thật thà chứ không phải một chỗ thiếu.
   */
  async collectExplanationSignals({ userId, item }) {
    if (!userId) {
      return {};
    }

    const [profile, keywords, behaviors] = await Promise.all([
      recommendationRepository.findProfile(userId),
      recommendationRepository.findRecentKeywords(userId, { limit: 8 }),
      recommendationRepository.findRecentBehaviors(userId, {
        since: new Date(Date.now() - EXPLANATION_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        limit: 60,
      }),
    ]);

    const viewedIds = [
      ...new Set(behaviors.map((row) => row.productId).filter((id) => id && id !== item.productId)),
    ].slice(0, 12);

    const viewedCards = viewedIds.length > 0 ? await recommendationRepository.findProductCards(viewedIds) : new Map();
    const target = (await recommendationRepository.findProductCards([item.productId])).get(item.productId);

    return {
      keywords: [...new Set(keywords.map((row) => row.keyword).filter(Boolean))].slice(0, 5),
      preferredCategories: toNameList(profile?.preferredCategories),
      preferredBrands: toNameList(profile?.preferredBrands),
      priceRange:
        profile?.minPrice && profile?.maxPrice
          ? `${formatVnd(profile.minPrice)} – ${formatVnd(profile.maxPrice)}`
          : null,
      // Chỉ sản phẩm CÙNG DANH MỤC với sản phẩm đang giải thích. Liệt kê mọi thứ
      // khách từng xem thì model sẽ vin vào một cái tai nghe để giải thích vì sao
      // gợi ý laptop.
      viewedInSameCategory: [...viewedCards.values()]
        .filter((row) => row.category?.id && row.category.id === target?.category?.id)
        .map((row) => row.name)
        .slice(0, 3),
    };
  }

  /** Một lượt gọi model không tool, dùng cho sinh văn bản một-lượt. */
  async generateText({ model, system, prompt }) {
    const client = getClient();

    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL },
        },
      });

      return { text: response.text || "", model };
    } catch (error) {
      logger.error("Gemini text call failed", { model, error: logger.serializeError(error) });
      throw error;
    }
  }

  /** Hội thoại của người gọi, cho trang quản lý lịch sử tư vấn. */
  async listConversations({ userId = null, sessionId = null }) {
    // Khách vãng lai chưa có session key thì không có gì để liệt kê — và truy
    // vấn với `sessionId = null` sẽ khớp mọi hội thoại mồ côi của người khác.
    if (!userId && !sessionId) {
      return { items: [] };
    }

    const rows = await aiRepository.findConversations({ userId, sessionId });

    return { items: rows };
  }

  /** Toàn bộ lượt hỏi đáp của một hội thoại, kèm sản phẩm từng lượt đã gợi ý. */
  async getConversation({ userId = null, sessionId = null, conversationId }) {
    const conversation = await this.assertOwnership({ userId, sessionId, conversationId });
    const { messages, productsByMessage } = await aiRepository.findConversationMessages(conversation.id);

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        conversationType: conversation.conversationType,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        products: productsByMessage[message.id] || [],
        // Lưu lượng tool đã ghi lúc trả lời — nhờ vậy mở lại hội thoại cũ vẫn
        // xem được AI đã tra những gì, không chỉ xem được ngay lúc vừa hỏi.
        toolCalls: message.structuredData?.toolCalls || [],
      })),
    };
  }

  async closeConversation({ userId = null, sessionId = null, conversationId }) {
    await this.assertOwnership({ userId, sessionId, conversationId });
    await aiRepository.closeConversation(conversationId);

    return { conversationId };
  }

  /**
   * Chủ sở hữu hội thoại, hoặc 404.
   *
   * Trả 404 chứ không 403 cho hội thoại của người khác: 403 xác nhận rằng id đó
   * CÓ TỒN TẠI, tức là biến endpoint thành công cụ dò id hợp lệ.
   */
  async assertOwnership({ userId, sessionId, conversationId }) {
    const conversation = await aiRepository.findConversation(conversationId);

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const ownedByUser = userId && conversation.userId === userId;
    const ownedBySession = !conversation.userId && sessionId && conversation.sessionId === sessionId;

    if (!ownedByUser && !ownedBySession) {
      throw new AppError("Conversation not found", 404);
    }

    return conversation;
  }

  /**
   * Continues an existing thread or opens a new one.
   *
   * The ownership check is the point: conversation ids are UUIDs in a request
   * body, so without it anyone holding an id could read a stranger's chat. A
   * signed-in shopper owns their conversations by `userId`; a guest owns theirs
   * by the session key the behaviour tracker already issues.
   */
  async resolveConversation({ userId, sessionId, conversationId, message, conversationType }) {
    if (conversationId) {
      const existing = await this.assertOwnership({ userId, sessionId, conversationId });

      if (existing.status === "CLOSED") {
        throw new AppError("Conversation is closed", 409);
      }

      // Kiểu hội thoại do lượt ĐẦU TIÊN quyết định và không đổi được. Cho phép
      // đổi giữa chừng nghĩa là nửa đầu chạy bằng prompt Advisor còn nửa sau
      // bằng prompt Comparison, trong khi lịch sử vẫn được nạp nguyên vẹn — model
      // nhận một cuộc hội thoại mà luật chơi đổi giữa chừng.
      return existing;
    }

    return aiRepository.createConversation({
      userId,
      sessionId,
      conversationType,
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
  async runToolLoop({ contents, conversationType, model }) {
    const client = getClient();
    const agent = getAgent(conversationType);
    const systemInstruction = agent.buildSystemInstruction(await loadVocabulary());

    // Agent nào chỉ thấy tool của agent đó. Comparison không nên vô tình dùng
    // được một tool chỉ Advisor mới có ngữ cảnh để dùng đúng.
    const functionDeclarations = agent.toolNames.map((name) => TOOLS[name]);

    const baseConfig = {
      systemInstruction,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: THINKING_LEVEL },
    };

    let products = [];
    const toolCalls = [];
    // Bản ghi TOOL chờ ghi xuống DB. Gom ở đây chứ không ghi ngay, vì vòng lặp
    // này có thể bị chạy lại nguyên vẹn trên model dự phòng.
    const toolRecords = [];
    const usage = { promptTokens: 0, completionTokens: 0 };
    let turn = 0;

    while (true) {
      const toolsExhausted = turn >= MAX_TOOL_TURNS;

      // Dropping `tools` is not enough to stop the model calling one: it has a
      // transcript full of tool calls to imitate, and it will emit another,
      // leaving `response.text` empty and the shopper with a canned apology.
      // `mode: NONE` closes that door, and the nudge tells it the search phase
      // is over so it answers from what it already has.
      if (toolsExhausted) {
        contents.push({
          role: "user",
          parts: [
            {
              text: "Đã tìm xong. Hãy trả lời ngay bây giờ bằng dữ liệu đã có ở trên, không gọi thêm tool nữa.",
            },
          ],
        });
      }

      let response;

      try {
        response = await client.models.generateContent({
          model,
          contents,
          config: toolsExhausted
            ? { ...baseConfig, toolConfig: { functionCallingConfig: { mode: "NONE" } } }
            : { ...baseConfig, tools: [{ functionDeclarations }] },
        });
      } catch (error) {
        // Ném NGUYÊN lỗi của SDK: `ask()` mới là nơi quyết định thử model khác
        // hay dừng, và nó cần chuỗi lỗi gốc để phân loại. Dịch sang AppError ở
        // đây là làm mất thông tin đó ngay trước chỗ cần dùng.
        logger.error("Gemini call failed", { model, error: logger.serializeError(error) });
        throw error;
      }

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
          toolRecords,
          usage,
          model,
        };
      }

      // The model's own turn is echoed back verbatim rather than rebuilt from
      // `functionCalls`, because the candidate content carries fields (thought
      // signatures among them) that the next request must see unchanged.
      const modelTurn = response.candidates?.[0]?.content;
      contents.push(modelTurn || { role: "model", parts: calls.map((call) => ({ functionCall: call })) });

      const responseParts = [];

      for (const call of calls) {
        const result = await this.runTool(call);
        products = result.products.length > 0 ? result.products : products;
        toolCalls.push({ name: call.name, args: call.args || {}, resultCount: result.products.length });
        if (result.record) toolRecords.push(result.record);

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

  /**
   * Executes one tool call and RETURNS what should be persisted for it.
   *
   * Ghi vào cơ sở dữ liệu ở đây thì vòng lặp không chạy lại được: fallback sang
   * model khác chạy lại cả vòng, và mỗi lần chạy lại sẽ nhân đôi dòng `TOOL`.
   * Nên nó chỉ trả dữ liệu về, `ask()` ghi một lượt sau khi đã có câu trả lời.
   *
   * Đổi vậy còn sửa một lỗi âm thầm đang có: câu hỏi hỏng giữa chừng trước đây
   * để lại tin nhắn `TOOL` mồ côi trong một hội thoại không có lượt trả lời nào.
   */
  async runTool(call) {
    if (!TOOLS[call.name]) {
      return {
        products: [],
        payload: { error: `Unknown tool "${call.name}"` },
      };
    }

    const byName = call.name === FIND_BY_NAME_TOOL.name;
    const args = byName ? normaliseNameArgs(call.args || {}) : normaliseSearchArgs(call.args || {});

    let products = [];
    let payload;

    try {
      products = byName
        ? await aiRepository.findProductsByNames(args.names)
        : await aiRepository.searchProducts(args);

      payload = {
        // Named `products` rather than returned bare so a zero-result search
        // reads as an explicit empty list. The model treats a missing key as an
        // error and retries; an empty array is an answer.
        products: products.map((product) => toModelView(product, { verbose: byName })),
        count: products.length,
      };

      // Tên nào không tra ra sản phẩm phải được nói rõ. Trả về im lặng thiếu
      // một cột thì model sẽ so sánh hai sản phẩm và lờ đi cái thứ ba khách vừa
      // nhắc — trông như nó cố tình bỏ qua.
      if (byName && products.length < args.names.length) {
        payload.notFound = args.names.filter(
          (name) => !products.some((product) => tokenOverlap(name, product.name) >= 0.5),
        );
      }
    } catch (error) {
      logger.error("AI advisor tool call failed", {
        tool: call.name,
        args,
        error: logger.serializeError(error),
      });
      payload = { error: "Product lookup failed", products: [], count: 0 };
    }

    return {
      products,
      payload,
      record: {
        role: "TOOL",
        content: JSON.stringify(args),
        structuredData: {
          tool: call.name,
          args,
          productIds: products.map((product) => product.id),
        },
      },
    };
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
/**
 * Hàng DB → thứ model được nhìn thấy.
 *
 * `verbose` chỉ bật ở đường SO SÁNH (`find_products_by_name`, tối đa 4 sản
 * phẩm). Nó thêm mô tả dài và vài đánh giá của khách — nguyên liệu để viết ưu
 * và nhược điểm.
 *
 * Đường tư vấn (`search_products`) KHÔNG bật, và đó là chủ đích: nó trả về hàng
 * chục sản phẩm, mà nhân mỗi sản phẩm thêm ~600 token mô tả cộng review là đủ
 * đẩy một câu hỏi bình thường vượt ngân sách context — để đổi lấy thứ mà một
 * danh sách gợi ý không dùng đến.
 */
const toModelView = (product, { verbose = false } = {}) => ({
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
  ...(verbose
    ? {
        description: product.description ? product.description.slice(0, DESCRIPTION_MAX_CHARS) : null,
        // Đặt tên trường nói rõ đây là lời NGƯỜI DÙNG viết, không phải dữ liệu
        // của cửa hàng. Prompt dựa vào tên này để phân biệt hai loại.
        customerReviews: product.reviews || [],
      }
    : {}),
});

// ── Lỗi từ nhà cung cấp ─────────────────────────────────────────────────────

/**
 * Dịch lỗi của SDK Gemini thành lỗi của API này.
 *
 * Không dịch thì mọi thứ rơi vào `errorHandler` như một 500 vô danh, và người
 * dùng đọc được "máy chủ đang bận" trong khi sự thật là hết hạn mức miễn phí
 * trong ngày — một thứ thử lại bao nhiêu lần cũng vô ích. Đây là lỗi ĐÃ XẢY RA
 * lúc chạy thử, không phải phòng xa.
 *
 * SDK ném lỗi với `message` là nguyên văn JSON của Google, nên mã lỗi được đọc
 * từ đó thay vì từ một trường có sẵn.
 */
/**
 * Câu chữ cho người dùng, theo phân loại lỗi của nhà cung cấp.
 *
 * Việc NHẬN DẠNG lỗi nằm ở `geminiConfig.classifyError` — đó là kiến thức về
 * Gemini, và cũng chính là thứ quyết định có thử model dự phòng hay không. Ở đây
 * chỉ dịch phân loại thành câu chữ và mã HTTP, nên hai nơi không thể lệch nhau
 * khi Google đổi định dạng lỗi.
 */
const ERROR_MESSAGES = {
  quotaDaily: [
    "Trợ lý đã dùng hết lượt hỏi miễn phí trong ngày hôm nay. Bạn quay lại vào ngày mai nhé.",
    429,
  ],
  quotaMinute: [
    "Trợ lý đang nhận quá nhiều câu hỏi. Bạn đợi khoảng một phút rồi hỏi lại nhé.",
    429,
  ],
  modelMissing: ["Trợ lý chưa được cấu hình đúng trên máy chủ này", 503],
  auth: ["Trợ lý chưa được cấu hình đúng trên máy chủ này", 503],
  // Chỉ tới được đây khi MỌI model dự phòng đều quá tải cùng lúc — hiếm, và
  // khác hẳn "chưa cấu hình": lần này thử lại thật sự có ích.
  overloaded: ["Trợ lý đang quá tải. Bạn thử lại sau một chút nhé.", 503],
};

/**
 * Lỗi của nhà cung cấp → lỗi của API này.
 *
 * Không dịch thì mọi thứ rơi vào `errorHandler` như một 500 vô danh, và người
 * dùng đọc được "máy chủ đang bận" trong khi sự thật là hết hạn mức miễn phí
 * trong ngày — một thứ thử lại bao nhiêu lần cũng vô ích. Trả `null` cho lỗi lạ
 * để nơi gọi ném nguyên bản gốc thay vì che nó bằng một thông điệp đoán mò.
 */
const toAppError = (error) => {
  const mapped = ERROR_MESSAGES[classifyError(error).kind];

  return mapped ? new AppError(mapped[0], mapped[1]) : null;
};

// ── Argument hygiene ────────────────────────────────────────────────────────

/**
 * The model's arguments are input, not instructions.
 *
 * Two failures are worth the guard. It routinely sends prices in millions
 * ("20" for 20 triệu) because that is how the question was phrased, and it will
 * ask for a limit of 50 when the prompt says 12. Both are cheap to correct here
 * and expensive to notice in an answer.
 */
/** Tên sản phẩm model gửi lên: lọc rác, cắt trần, bỏ trùng. */
const normaliseNameArgs = (args) => {
  const names = Array.isArray(args.names) ? args.names : [];

  return {
    names: [
      ...new Set(
        names
          .filter((name) => typeof name === "string")
          .map((name) => name.trim())
          .filter((name) => name.length > 1),
      ),
      // Bốn là trần: một bảng so sánh năm cột trên điện thoại thì không đọc nổi,
      // và mỗi cột thêm vào là thêm thông số vào context.
    ].slice(0, 4),
  };
};

/** Tỉ lệ từ trong `query` xuất hiện ở `candidate`. Dùng để biết tên nào tra hụt. */
const tokenOverlap = (query, candidate) => {
  const words = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1);

  const tokens = words(query);
  if (tokens.length === 0) return 0;

  const haystack = words(candidate);
  return tokens.filter((token) => haystack.some((word) => word.includes(token))).length / tokens.length;
};

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
