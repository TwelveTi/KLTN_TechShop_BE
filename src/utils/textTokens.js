// Chuẩn hoá và tách từ cho việc khớp văn bản tiếng Việt.
//
// Tách bằng `/[^a-z0-9]+/` trên chuỗi CÒN DẤU là một cái bẫy im lặng: chữ có
// dấu không nằm trong `a-z0-9` nên nó không tách từ mà **băm từ thành vụn**.
// Đo trên chính `search_histories` của bộ seed:
//
//   "bàn phím không dây gõ êm"     -> []            (rỗng hoàn toàn)
//   "máy tính bảng vẽ có bút"      -> []
//   "đồng hồ thông minh"           -> ["minh"]
//   "điện thoại chụp ảnh đẹp"      -> ["tho"]
//   "chuột logitech công thái học" -> ["chu", "logitech"]
//
// Mảnh còn lại không chỉ mất tín hiệu mà còn khớp sai: "chu" khớp mọi tên chứa
// "chu". Bỏ dấu TRƯỚC khi tách thì "đồng hồ thông minh" ra ["dong","thong","minh"]
// và khớp đúng "Đồng hồ thông minh Apple Watch Ultra 2".
//
// `đ`/`Đ` phải map riêng: NFD không tách chúng thành chữ cơ sở + dấu (U+0111 là
// một chữ cái độc lập trong Unicode), nên chỉ strip dấu thanh là chưa đủ.
//
// CÙNG một hàm phải dùng cho cả hai phía — từ khoá và chuỗi bị khớp. Bỏ dấu một
// phía thôi thì "dong" không bao giờ gặp "đồng".
//
// Ghi chú nợ: `aiRepository.tokenize`, `aiService.tokenOverlap` và
// `utils/slug.slugify` mỗi chỗ có một bản sao gần giống của phép này, và bản
// trong `aiService` thiếu bước `đ -> d` (nên "đồng" ra "ong"). Chưa gộp ở đây vì
// `aiRepository.tokenize` là đường khớp tên sản phẩm của tính năng so sánh AI,
// đổi nó cần lượt kiểm riêng.

/** Bỏ dấu tiếng Việt và hạ chữ thường, giữ nguyên khoảng trắng/ký tự khác. */
const foldDiacritics = (value) =>
  String(value || "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Tách thành token đã bỏ dấu.
 *
 * @param {string} value
 * @param {number} minLength số ký tự tối thiểu để giữ lại một token. Mặc định 3:
 *   token một hai ký tự khớp với gần như mọi thứ và chỉ làm loãng điểm.
 */
const tokenizeFolded = (value, { minLength = 3 } = {}) =>
  foldDiacritics(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= minLength);

module.exports = { foldDiacritics, tokenizeFolded };
