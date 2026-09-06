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
  // Rendered as a tree, not a flat list. Shown flat, the model has no way to
  // know that `laptop-gaming` sits inside `laptop-may-tinh`, so after a broad
  // search that already returned every laptop it goes on to query each child
  // individually — three tool turns to rediscover the first result. Indentation
  // plus the note below is the whole fix.
  //
  // The repository already withheld categories holding no products, so every
  // slug here can return a row. Counts come along so the model can tell a
  // well-stocked category from one holding a single item.
  const specLine = (category) =>
    category.specs
      .map((spec) => `${spec.key} (${spec.dataType}${spec.unit ? `, ${spec.unit}` : ""})`)
      .join(", ");

  // A child inherits its parent's definitions verbatim (see taxonomySeeder), so
  // repeating them under every child is the same six keys printed four times.
  // Printed only where they differ, which today means only on the parents.
  const render = (category, depth, inherited) => {
    const specs = specLine(category);
    const indent = "  ".repeat(depth);
    const showSpecs = specs && specs !== inherited;

    return `${indent}- ${category.slug} — ${category.name} (${category.productCount} sản phẩm)${
      showSpecs ? `\n${indent}    specs: ${specs}` : ""
    }`;
  };

  const roots = categories.filter((category) => !category.parentSlug);
  const categoryLines = roots
    .flatMap((root) => [
      render(root, 0, null),
      ...categories
        .filter((child) => child.parentSlug === root.slug)
        .map((child) => render(child, 1, specLine(root))),
    ])
    .join("\n");

  return [
    "DANH MỤC VÀ THÔNG SỐ CÓ THỂ LỌC (danh mục thụt vào là con của danh mục trên nó):",
    categoryLines,
    "",
    "Tìm ở danh mục cha là ĐÃ BAO GỒM toàn bộ danh mục con của nó. Không cần gọi",
    "tool thêm lần nữa cho từng danh mục con — kết quả đã nằm trong lần tìm trước.",
    "Danh mục con dùng chung bộ thông số với danh mục cha của nó.",
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
