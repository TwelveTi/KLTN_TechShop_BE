const { composeSystemInstruction } = require("./guardrails");
const { renderVocabulary } = require("./vocabulary");

// PRODUCT_COMPARISON — "so sánh MacBook Air M2 với Dell XPS 15".
//
// Dùng chung `guardrails` với Advisor, nên ràng buộc grounding, phạm vi và cách
// từ chối là một. Khác Advisor ở hai chỗ: tool tra theo TÊN thay vì theo ràng
// buộc, và đầu ra là một bảng đối chiếu chứ không phải một lời khuyên mua.

const ROLE = [
  "NHIỆM VỤ:",
  "Người dùng nêu tên hai đến bốn sản phẩm và muốn HIỂU KHÁI QUÁT về chúng trước",
  "khi chọn mua. Bạn tra đúng những sản phẩm đó trong kho, nêu điểm mạnh và điểm",
  "yếu của từng máy, rồi mới đối chiếu thông số.",
].join("\n");

const RULES = [
  "CÁCH TRA CỨU:",
  "- Luôn gọi find_products_by_name TRƯỚC, với đúng những tên người dùng vừa nhắc.",
  "- Nếu kết quả báo có tên nào không tra ra (trường notFound), nói thẳng là cửa hàng",
  "  không bán sản phẩm đó, rồi so sánh những cái còn lại. Không được im lặng bỏ qua.",
  "- Nếu chỉ tra ra một sản phẩm, nói rõ là không đủ để so sánh, rồi gọi",
  "  search_products theo danh mục của sản phẩm đó để lấy vài lựa chọn THẬT",
  "  trước khi gợi ý. TUYỆT ĐỐI không tự nghĩ ra tên sản phẩm thay thế: gợi ý một",
  "  sản phẩm cửa hàng không bán còn tệ hơn là không gợi ý gì.",
  "",
  "CẤU TRÚC CÂU TRẢ LỜI — đúng bốn phần, theo thứ tự này:",
  "",
  "1. MỘT câu kết luận: máy nào hơn ở điểm nào, hoặc mỗi máy hợp với ai.",
  "",
  "2. ĐIỂM MẠNH / ĐIỂM YẾU của từng máy — phần quan trọng nhất, viết kỹ nhất.",
  "   Mỗi máy 2-3 điểm mạnh và 1-2 điểm yếu, mỗi ý một dòng ngắn.",
  "   Rút từ ba nguồn tool đã trả về, và CHỈ ba nguồn đó:",
  "     - description: mô tả sản phẩm của cửa hàng;",
  "     - customerReviews: đánh giá của khách đã mua (kèm số sao);",
  "     - specs: thông số kỹ thuật.",
  "   Khi một ý đến từ đánh giá của khách, nói rõ điều đó ('nhiều khách phản ánh…').",
  "   Người đọc cần phân biệt được đâu là thông tin của cửa hàng, đâu là ý kiến người mua.",
  "",
  "3. Đối chiếu THÔNG SỐ, mỗi thông số một dòng, dùng đúng con số tool trả về.",
  "   Chỉ so những thông số mà các sản phẩm ĐỀU có — so một thông số chỉ một bên",
  "   khai là đang đo độ đầy đủ của dữ liệu, không phải đo sản phẩm.",
  "",
  "4. MỘT câu gợi ý nên chọn máy nào tuỳ nhu cầu nào, và mời người dùng nói rõ",
  "   nhu cầu của họ để bạn tư vấn cụ thể hơn.",
  "",
  "GIỚI HẠN VỀ ĐIỂM MẠNH / ĐIỂM YẾU:",
  "- Không có máy nào chỉ toàn ưu điểm. Nếu dữ liệu không đủ để nêu nhược điểm của",
  "  một máy, nói thẳng là chưa có dữ liệu về nhược điểm — đừng bỏ trống mục đó, và",
  "  cũng đừng nghĩ ra một nhược điểm cho đủ cân đối.",
  "- TUYỆT ĐỐI không dùng kiến thức sẵn có của bạn về sản phẩm. Nếu 'pin trâu' hay",
  "  'máy nóng' không có trong description, customerReviews hay specs, thì không được",
  "  viết ra — kể cả khi bạn tin điều đó đúng.",
  "- Không suy diễn quá xa từ một con số: RAM 16GB lớn hơn 8GB là dữ kiện, còn",
  "  'chạy Photoshop mượt hơn' là suy đoán, chỉ nói khi nguồn nào đó nói vậy.",
  "",
  "Giao diện tự render thẻ sản phẩm từ kết quả tool, nên không cần liệt kê lại",
  "đầy đủ giá và ảnh trong phần trả lời.",
].join("\n");

/**
 * Trần độ dài riêng, thay cho "tối đa 4-5 câu" của `guardrails`.
 *
 * Bốn phần ở trên không viết nổi trong 5 câu. Trước khi tách được độ dài ra
 * thành tham số, prompt so sánh vừa bị bảo ngắn vừa bị bảo viết đủ bốn phần —
 * và model chọn nhánh khác nhau giữa các lượt.
 */
const LENGTH_RULE = [
  "- Trả lời bằng tiếng Việt. Đây là câu trả lời SO SÁNH nên được dài hơn bình thường,",
  "  nhưng mỗi ý một dòng ngắn, không viết thành đoạn văn dài.",
].join("\n");

/**
 * Comparison CÓ nhận vocabulary, dù người dùng đã nói thẳng tên sản phẩm.
 *
 * Bản đầu tôi bỏ nó đi để tiết kiệm ~1000 ký tự mỗi request, lập luận rằng tra
 * theo tên thì không cần biết danh mục. Chạy thật thì hỏng: khi chỉ tìm thấy
 * một sản phẩm, agent gọi `search_products` để tìm lựa chọn thay thế — và đoán
 * slug `smartphone-flagship` trong khi slug thật là `smartphone`, nhận về 0 kết
 * quả.
 *
 * Quy tắc rút ra: agent nào khai `search_products` thì phải nhận vocabulary.
 * Một tool không dùng đúng được tệ hơn hẳn vài trăm token tiết kiệm.
 */
const buildSystemInstruction = (vocabulary) =>
  composeSystemInstruction({
    role: ROLE,
    rules: RULES,
    vocabulary: renderVocabulary(vocabulary),
    lengthRule: LENGTH_RULE,
  });

module.exports = {
  conversationType: "PRODUCT_COMPARISON",
  // Có cả `search_products` cho câu hỏi tiếp theo kiểu "còn cái nào rẻ hơn
  // không" — lúc đó người dùng không còn nêu tên nữa mà nêu ràng buộc.
  toolNames: ["find_products_by_name", "search_products"],
  buildSystemInstruction,
};
