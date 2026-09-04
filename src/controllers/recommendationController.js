const recommendationService = require("../services/recommendationService");
const APIResponse = require("../utils/ApiResponse");

class RecommendationController {
  // Personalised rail. Anonymous visitors get the popularity list rather than an
  // error — a storefront rail must always render something.
  async getForMe(req, res) {
    const result = await recommendationService.getForUser({
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
      limit: req.query.limit,
      strategy: req.query.strategy,
    });

    return APIResponse.success(res, "Get recommendations successfully", result);
  }

  async getSimilarProducts(req, res) {
    const result = await recommendationService.getSimilarProducts(req.params.id, {
      limit: req.query.limit,
      // Optional: a guest still gets the rail, it just is not attributed.
      userId: req.user?.id || null,
      sessionId: req.sessionKey || null,
    });

    return APIResponse.success(res, "Get similar products successfully", result);
  }

  // Closes the loop: a shown recommendation that was clicked / carted / bought.
  // These timestamps are what the evaluation chapter measures.
  async recordOutcome(req, res) {
    const result = await recommendationService.recordOutcome(
      req.params.itemId,
      req.body.outcome,
      req.user?.id || null,
    );

    return APIResponse.success(res, "Outcome recorded", result);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async rebuildSimilarity(req, res) {
    const result = await recommendationService.rebuildSimilarityMatrix({
      perProduct: req.body.perProduct,
      minScore: req.body.minScore,
    });

    return APIResponse.success(res, "Similarity matrix rebuilt", result);
  }

  async getOutcomeStats(req, res) {
    const result = await recommendationService.getOutcomeStats();

    return APIResponse.success(res, "Get recommendation outcome stats successfully", result);
  }
}

module.exports = new RecommendationController();
