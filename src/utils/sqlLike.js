// Escape `%`, `_` và `\` để chuỗi người dùng nhập được tìm đúng nghĩa đen trong LIKE, không thành ký tự đại diện.
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (char) => `\\${char}`);

// Mẫu "chứa chuỗi" cho Op.like.
const likeContains = (value) => `%${escapeLike(value)}%`;

module.exports = { escapeLike, likeContains };
