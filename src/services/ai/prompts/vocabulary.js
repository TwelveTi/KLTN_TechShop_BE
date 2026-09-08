/**
 * Danh mục và thông số mà model được phép lọc, render thành cây.
 *
 * Dùng chung cho mọi agent có tool `search_products`. Ban đầu nó nằm riêng
 * trong `advisor.js` và Comparison cố ý không nhận vocabulary để tiết kiệm
 * ~1000 ký tự mỗi request. Đó là một lỗi đo được: Comparison vẫn có
 * `search_products` trong tay, và khi cần tìm sản phẩm thay thế nó đoán slug
 * `smartphone-flagship` — trong khi slug thật là `smartphone` — rồi nhận 0 kết
 * quả. Một tool không dùng đúng được thì tệ hơn hẳn vài trăm token tiết kiệm.
 *
 * Quy tắc: agent nào khai `search_products` thì agent đó phải nhận vocabulary.
 */

/**
 * Render dạng CÂY, không phải danh sách phẳng.
 *
 * Danh sách phẳng khiến model không biết `laptop-gaming` nằm trong
 * `laptop-may-tinh`, nên sau một lần tìm rộng đã bao trọn rồi nó vẫn đi dò từng
 * danh mục con — đo được 3 lượt tool và 53 giây cho một câu hỏi. Thụt đầu dòng
 * cộng câu ghi chú bên dưới đưa về 1 lượt và 5 giây.
 *
 * Danh mục rỗng đã bị repository loại từ trước, nên mọi slug ở đây đều có thể
 * trả về hàng. Số lượng đi kèm để model phân biệt danh mục đầy hàng với danh
 * mục chỉ có một món.
 */
function renderVocabulary({ categories, brands }) {
  const specLine = (category) =>
    category.specs
      .map((spec) => `${spec.key} (${spec.dataType}${spec.unit ? `, ${spec.unit}` : ""})`)
      .join(", ");

  // Danh mục con kế thừa nguyên bộ định nghĩa của cha (xem taxonomySeeder), nên
  // in lại dưới mỗi con là cùng sáu khoá lặp bốn lần.
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
}

module.exports = { renderVocabulary };
