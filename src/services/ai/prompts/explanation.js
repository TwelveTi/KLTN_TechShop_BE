const { IDENTITY } = require("./guardrails");

// RECOMMENDATION_EXPLANATION — "vì sao tôi được gợi ý sản phẩm này?".
//
// Khác hẳn Advisor và Comparison ở một điểm quyết định toàn bộ thiết kế: ở đây
// **không có gì để model chọn**. Sản phẩm đã được bộ gợi ý ở mục 6 chọn xong,
// điểm từng thành phần đã tính xong và ghi vào `reasonMetadata`. Việc còn lại
// chỉ là diễn đạt một bản ghi cố định thành câu tiếng Việt.
//
// Vì vậy nó KHÔNG dùng tool và KHÔNG đi qua `AiConversation` — service nạp dữ
// liệu rồi đưa thẳng vào prompt. Nghe như vi phạm 7.0.1, nhưng thực ra là ràng
// buộc chặt hơn: model không có quyền chọn sản phẩm nào cả, nên không có chỗ
// nào để nó bịa ra một sản phẩm.

/**
 * Không dùng `composeSystemInstruction` của `guardrails`.
 *
 * Khối GROUNDING ở đó nói về tool ("mọi thông tin phải đến từ kết quả tool"),
 * mà agent này không có tool nào — dán vào sẽ là một luật trỏ vào hư không, và
 * một luật vô nghĩa trong prompt làm loãng những luật còn lại. Khối SCOPE cũng
 * thừa: đây không phải chat, người dùng không gõ gì cả.
 *
 * Chỉ mượn IDENTITY để giọng văn thống nhất với hai agent kia.
 */
const SYSTEM = [
  IDENTITY,
  "",
  "NHIỆM VỤ:",
  "Giải thích cho khách vì sao hệ thống gợi ý sản phẩm này cho họ.",
  "",
  "QUY TẮC:",
  "1. CHỈ dùng dữ liệu trong phần DỮ LIỆU bên dưới. Không thêm bất kỳ chi tiết nào khác",
  "   về sản phẩm, về khách, hay về lý do — kể cả khi bạn nghĩ nó hợp lý.",
  "2. Nói với khách bằng ngôi thứ hai (\"bạn\"), tự nhiên, như người bán hàng giải thích.",
  "3. TỐI ĐA 2 câu. Đây là dòng chú thích dưới một thẻ sản phẩm, không phải một đoạn văn.",
  "4. Nêu bằng chứng cụ thể: từ khoá khách đã tìm, hãng khách hay xem, tầm giá khách quan tâm.",
  "   Nói \"phù hợp với bạn\" mà không kèm bằng chứng thì không giải thích được gì.",
  "5. Không nhắc tới điểm số, thuật toán, tên thành phần hay bất cứ thứ gì thuộc về kỹ thuật.",
  "   Khách cần biết LÝ DO, không cần biết cách tính.",
  "6. Nếu dữ liệu chỉ có mức độ phổ biến, hãy nói thật là sản phẩm này đang được nhiều",
  "   người mua — đừng giả vờ đó là gợi ý cá nhân hoá.",
].join("\n");

/** Nhãn tiếng Việt cho từng thành phần, dùng khi mô tả tín hiệu nào mạnh nhất. */
const SIGNAL_LABELS = {
  userPreference: "sở thích đã quan sát được (danh mục, hãng, tầm giá)",
  searchHistory: "từ khoá khách đã tìm gần đây",
  purchaseHistory: "sản phẩm khách từng mua",
  productSimilarity: "sản phẩm khách đã xem",
  popularity: "mức độ bán chạy chung",
};

/**
 * Dựng phần DỮ LIỆU.
 *
 * Chỉ đưa vào những gì có thật: trường rỗng bị bỏ hẳn thay vì ghi "không có".
 * Một dòng "hãng ưa thích: (trống)" là lời mời để model bịa ra một cái tên.
 */
function buildUserPrompt({ product, dominant, signals }) {
  const lines = ["DỮ LIỆU", "", `Sản phẩm được gợi ý: ${product.name}`];

  if (product.category) lines.push(`Danh mục: ${product.category}`);
  if (product.brand) lines.push(`Thương hiệu: ${product.brand}`);
  if (product.price) lines.push(`Giá: ${product.price}`);

  lines.push("", `Tín hiệu mạnh nhất: ${SIGNAL_LABELS[dominant] || "mức độ bán chạy chung"}`);

  if (signals.keywords?.length) {
    lines.push(`Từ khoá khách đã tìm gần đây: ${signals.keywords.join(", ")}`);
  }
  if (signals.preferredCategories?.length) {
    lines.push(`Danh mục khách hay xem: ${signals.preferredCategories.join(", ")}`);
  }
  if (signals.preferredBrands?.length) {
    lines.push(`Hãng khách hay xem: ${signals.preferredBrands.join(", ")}`);
  }
  if (signals.priceRange) {
    lines.push(`Tầm giá khách quan tâm: ${signals.priceRange}`);
  }
  if (signals.viewedInSameCategory?.length) {
    lines.push(`Sản phẩm cùng loại khách đã xem: ${signals.viewedInSameCategory.join(", ")}`);
  }

  lines.push("", "Viết lời giải thích:");

  return lines.join("\n");
}

module.exports = { SYSTEM, SIGNAL_LABELS, buildUserPrompt };
