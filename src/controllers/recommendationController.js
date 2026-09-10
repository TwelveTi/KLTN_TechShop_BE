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
    const result = await recommendationService.recordOutcome(req.params.itemId, req.body.outcome, {
      userId: req.user?.id || null,
      // Bắt buộc: dải "sản phẩm tương tự" ĐƯỢC lưu cho khách vãng lai (khoá theo
      // `sessionId`), nên thiếu nó thì khách vãng lai không báo được kết quả trên
      // chính dải của mình — và chốt chặn chủ sở hữu không có gì để xét.
      sessionId: req.sessionKey || null,
    });

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
    // `?since=` nối được tới repository. Trước đây controller gọi không tham số nên
    // `since` là code chết, và không có cách nào loại những lượt "shown" sinh ra
    // trước một mốc — ví dụ trước khi bật cache 15 phút, giai đoạn mà mỗi lần vào
    // trang chủ lại thêm 12 lượt chưa ai kịp bấm.
    // `Invalid Date` sẽ đi thẳng vào `replacements` và làm truy vấn ném lỗi, nên
    // giá trị không phân tích được thì coi như không truyền.
    const parsed = req.query.since ? new Date(req.query.since) : null;
    const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

    const result = await recommendationService.getOutcomeStats({ since });

    return APIResponse.success(res, "Get recommendation outcome stats successfully", result);
  }
}

module.exports = new RecommendationController();
