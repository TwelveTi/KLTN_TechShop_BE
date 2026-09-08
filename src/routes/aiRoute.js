const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const aiController = require("../controllers/aiController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { attachSessionId } = require("../middlewares/behaviorValidation");
const { validateAskAdvisor } = require("../middlewares/aiValidation");
const { validateIdParam } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");

// Unlike every other route in this app, each call here spends money on a
// third-party API. A loop in a client — or one impatient tester holding down
// enter — is a real bill, so the advisor is the one endpoint that throttles.
const advisorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "Too many questions, please wait a moment" },
});

// Optional auth on purpose: a visitor should be able to ask what fits their
// budget before creating an account. Signed in, the thread is theirs by user
// id; as a guest, by the same session key the behaviour tracker issues.
router.post(
  "/ai/advisor",
  advisorLimiter,
  optionalAuth,
  attachSessionId,
  validateAskAdvisor,
  asyncHandler(aiController.askAdvisor),
);

// So sánh sản phẩm. Cùng giới hạn với `/ai/advisor` vì cũng gọi model, và cùng
// bộ middleware vì cùng cách xác định chủ sở hữu hội thoại.
router.post(
  "/ai/compare",
  advisorLimiter,
  optionalAuth,
  attachSessionId,
  validateAskAdvisor,
  asyncHandler(aiController.askComparison),
);

// "Vì sao tôi được gợi ý sản phẩm này?" — về MỘT dòng recommendation_items, nên
// không đi qua AiConversation. Vẫn dùng `advisorLimiter` vì lượt đầu tiên của
// mỗi gợi ý là một lời gọi model thật; những lượt sau đọc bản đã lưu.
router.post(
  "/ai/recommendations/:itemId/explain",
  advisorLimiter,
  optionalAuth,
  attachSessionId,
  validateIdParam("itemId"),
  asyncHandler(aiController.explainRecommendation),
);

// Quản lý lịch sử tư vấn. KHÔNG qua `advisorLimiter`: giới hạn đó tồn tại vì
// mỗi câu hỏi tốn tiền gọi model, còn ba endpoint dưới đây chỉ đọc/ghi cơ sở dữ
// liệu. Bắt trang lịch sử chia chung hạn mức 10 lượt/phút với việc hỏi sẽ khiến
// chỉ chuyển qua lại vài cuộc hội thoại là bị chặn.
router.get(
  "/ai/conversations",
  optionalAuth,
  attachSessionId,
  asyncHandler(aiController.listConversations),
);

router.get(
  "/ai/conversations/:id",
  optionalAuth,
  attachSessionId,
  validateIdParam(),
  asyncHandler(aiController.getConversation),
);

router.delete(
  "/ai/conversations/:id",
  optionalAuth,
  attachSessionId,
  validateIdParam(),
  asyncHandler(aiController.closeConversation),
);

module.exports = router;
