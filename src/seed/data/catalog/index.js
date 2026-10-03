const laptops = require("./laptops");
const mobile = require("./mobile");
const audio = require("./audio");
const wearables = require("./wearables");
const accessories = require("./accessories");

/**
 * Bảng dòng sản phẩm của catalogue mở rộng — 175 mẫu.
 *
 * Đây là DỮ LIỆU VIẾT TAY: tên model, giá tham khảo tại Việt Nam, thông số kỹ
 * thuật và tag. `buildFamilyProducts.js` đọc bảng này rồi sinh ra phần khuôn mẫu
 * (slug, SKU, mô tả dài, ảnh, biến thể) để thành bản ghi sản phẩm hoàn chỉnh.
 *
 * Tách theo nhóm cho dễ sửa. Kiểm tra tính toàn vẹn nằm ở `validate.js`, chạy
 * mỗi lần seed nên một khoá trùng hay một thông số thiếu sẽ dừng ngay chứ không
 * âm thầm rơi mất như trước.
 */
const catalogFamilies = [...laptops, ...mobile, ...audio, ...wearables, ...accessories];

module.exports = catalogFamilies;
