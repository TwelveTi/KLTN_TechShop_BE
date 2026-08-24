const behaviorService = require("../services/behaviorService");
const APIResponse = require("../utils/ApiResponse");

class BehaviorController {
  // Open to anonymous visitors on purpose: the browsing that matters most to
  // recommendations happens before anyone signs in.
  async track(req, res) {
    const result = await behaviorService.recordFromClient({
      userId: req.user?.id || null,
      sessionId: req.sessionKey,
      events: req.body.events,
    });

    return APIResponse.success(res, "Activity recorded", result, 202);
  }

  async getMySearchHistory(req, res) {
    const result = await behaviorService.getMySearchHistory(req.user.id, req.query);

    return APIResponse.success(res, "Get search history successfully", result);
  }

  async getMyRecentKeywords(req, res) {
    const items = await behaviorService.getMyRecentKeywords(req.user.id, Number(req.query.limit) || 10);

    return APIResponse.success(res, "Get recent keywords successfully", { items });
  }

  async clearMySearchHistory(req, res) {
    const result = await behaviorService.clearMySearchHistory(req.user.id);

    return APIResponse.success(res, "Search history cleared", result);
  }

  async deleteMySearchHistoryEntry(req, res) {
    const result = await behaviorService.deleteMySearchHistoryEntry(req.user.id, req.params.id);

    return APIResponse.success(res, "Search history entry deleted", result);
  }

  async getMyPreferenceProfile(req, res) {
    const profile = await behaviorService.getMyProfile(req.user.id, {
      recompute: req.query.recompute === "true" || req.query.recompute === "1",
    });

    return APIResponse.success(res, "Get preference profile successfully", profile);
  }
}

module.exports = new BehaviorController();
