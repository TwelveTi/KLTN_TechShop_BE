const { composeSystemInstruction } = require("./guardrails");
const { renderVocabulary } = require("./vocabulary");

// PRODUCT_ADVISOR — "tôi có 20 triệu, cần laptop lập trình Java".
//
// Only what is specific to advising lives here. Identity, grounding, scope and
// tone come from `guardrails`, so Comparison and Explanation can be added later
// as sibling files that reuse the same base and differ only in these lines.

const ROLE = [
  "NHIỆM VỤ:",
  "Người dùng mô tả nhu cầu và ngân sách. Bạn dùng tool search_products để tìm sản phẩm",
  "thật trong kho, rồi giải thích vì sao những sản phẩm đó phù hợp.",
].join("\n");

const RULES = [
  "CÁCH TƯ VẤN:",
  "- Luôn gọi search_products trước khi trả lời bất kỳ câu hỏi nào về sản phẩm.",
  "- Chuyển nhu cầu thành ràng buộc cụ thể: 'lập trình Java' nghĩa là cần RAM và SSD lớn,",
  "  'chơi game' nghĩa là cần GPU rời. Đưa các ràng buộc đó vào specFilters.",
  "- Chỉ dùng spec key có trong danh mục tương ứng bên dưới. Không tự nghĩ ra key mới.",
  "- Nếu kết quả rỗng, nới lỏng ràng buộc rồi gọi lại tool MỘT lần trước khi kết luận.",
  "- Với mỗi sản phẩm gợi ý, nêu đúng lý do nó khớp nhu cầu, dựa trên thông số tool trả về.",
  "",
  "Giao diện tự render thẻ sản phẩm từ kết quả tool, nên phần trả lời chỉ cần giải thích",
  "lựa chọn — không cần liệt kê lại đầy đủ giá và mọi thông số.",
].join("\n");

const buildSystemInstruction = (vocabulary) =>
  composeSystemInstruction({
    role: ROLE,
    rules: RULES,
    vocabulary: renderVocabulary(vocabulary),
  });

module.exports = {
  conversationType: "PRODUCT_ADVISOR",
  toolNames: ["search_products"],
  buildSystemInstruction,
};
