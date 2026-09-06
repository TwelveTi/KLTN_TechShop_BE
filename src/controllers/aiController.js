const aiService = require("../services/aiService");
const APIResponse = require("../utils/ApiResponse");

class AiController {
  // Auth is optional: a visitor should be able to ask what laptop fits their
  // budget before deciding to make an account. A guest's thread is held by the
  // session key instead of a user id.
  async askAdvisor(req, res) {
    const result = await aiService.ask({
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
      conversationId: req.body.conversationId,
      message: req.body.message,
    });

    return APIResponse.success(res, "Advisor answered successfully", result);
  }

  async listConversations(req, res) {
    const result = await aiService.listConversations({
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
    });

    return APIResponse.success(res, "Get conversations successfully", result);
  }

  async getConversation(req, res) {
    const result = await aiService.getConversation({
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
      conversationId: req.params.id,
    });

    return APIResponse.success(res, "Get conversation successfully", result);
  }

  async closeConversation(req, res) {
    const result = await aiService.closeConversation({
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
      conversationId: req.params.id,
    });

    return APIResponse.success(res, "Conversation closed", result);
  }
}

module.exports = new AiController();
