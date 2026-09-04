const { composeSystemInstruction } = require("./guardrails");

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

/**
 * Renders the catalogue vocabulary the model is allowed to filter with.
 *
 * Without it the model invents filter keys: it asks for `ram_gb` or
 * `screen_size` because those are plausible names, and every one of them
 * matches nothing. Listing the real keys with their type and unit turns a guess
 * into a lookup.
 */
const renderVocabulary = ({ categories, brands }) => {
  // No filtering here any more: the repository already withheld the categories
  // that hold no products, and everything it did hand over is a slug that can
  // return a row. The product count comes along so the model can tell a
  // well-stocked category from one holding a single item, and stop narrowing
  // when there is nothing left to narrow into.
  const categoryLines = categories
    .map((category) => {
      const specs = category.specs
        .map((spec) => `${spec.key} (${spec.dataType}${spec.unit ? `, ${spec.unit}` : ""})`)
        .join(", ");

      return `- ${category.slug} — ${category.name} (${category.productCount} sản phẩm)${
        specs ? `\n    specs: ${specs}` : ""
      }`;
    })
    .join("\n");

  return [
    "DANH MỤC VÀ THÔNG SỐ CÓ THỂ LỌC:",
    categoryLines,
    "",
    `THƯƠNG HIỆU: ${brands.map((brand) => brand.name).join(", ")}`,
  ].join("\n");
};

const buildSystemInstruction = (vocabulary) =>
  composeSystemInstruction({
    role: ROLE,
    rules: RULES,
    vocabulary: renderVocabulary(vocabulary),
  });

module.exports = {
  conversationType: "PRODUCT_ADVISOR",
  buildSystemInstruction,
};
