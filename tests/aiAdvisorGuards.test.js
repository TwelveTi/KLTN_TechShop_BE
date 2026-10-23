// Hai chốt chặn của trợ lý AI: gọi Gemini quá hạn thì chuyển model như khi quá tải,
// và lượt tìm không kèm điều kiện nào thì không gắn thẻ sản phẩm vào câu trả lời.
const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "test-secret-that-is-long-enough-for-jwt-checks";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-long-enough-for-checks";

const { classifyError } = require("../src/configs/geminiConfig");
const aiRepository = require("../src/repositories/aiRepository");
const aiService = require("../src/services/aiService");

test("lỗi quá hạn của SDK được coi là quá tải và chuyển sang model khác", () => {
  const aborted = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  assert.deepEqual(classifyError(aborted), { kind: "overloaded", tryNextModel: true });
});

test("504 DEADLINE_EXCEEDED của Google được coi là quá tải và chuyển sang model khác", () => {
  // Nguyên văn lỗi Gemini trả về lúc kiểm thử 23/10.
  const deadline = Object.assign(
    new Error('{"error":{"code":504,"message":"Deadline expired before operation could complete.","status":"DEADLINE_EXCEEDED"}}'),
    { name: "ApiError" },
  );
  assert.deepEqual(classifyError(deadline), { kind: "overloaded", tryNextModel: true });
});

// Câu trả lời thật lấy từ lượt test tay 16/10.
const { pickMentionedProducts } = aiService;
const laptops = [
  { name: "Laptop HP ProBook 450 G10 (Core i5-1335U / 16GB / 512GB)" },
  { name: "Laptop Acer Swift Go 14 SFG14 (Core Ultra 5 125H / 16GB / 512GB)" },
  { name: "Laptop Gaming MSI Thin 15 B12UC (Core i5-12450H / RTX 3050)" },
  { name: "Laptop Lenovo IdeaPad Slim 5 14 (Ryzen 7 7730U / 16GB / 512GB)" },
];

test("chỉ gắn thẻ cho sản phẩm mà câu trả lời nhắc tới", () => {
  const answer =
    "1. **Acer Swift Go 14 SFG14** (19.990.000đ): nhẹ 1.32 kg. 2. **Lenovo IdeaPad Slim 5 14** (15.490.000đ): nặng 1.46 kg.";
  assert.deepEqual(
    pickMentionedProducts(answer, laptops).map((p) => p.name.slice(0, 22)),
    ["Laptop Acer Swift Go 1", "Laptop Lenovo IdeaPad "],
  );
});

test("trả lời là shop không bán thì không gắn thẻ nào", () => {
  const answer = "Hiện tại TechShop không kinh doanh máy ảnh chuyên dụng (bao gồm cả dòng Canon EOS R6).";
  const phones = [{ name: "Google Pixel 8 Pro (12GB / 256GB)" }, { name: "Apple iPhone 15 (128GB)" }];
  assert.deepEqual(pickMentionedProducts(answer, phones), []);
});

test("so sánh hai sản phẩm thì gắn đủ cả hai", () => {
  const answer = "Logitech MX Master 3S for Mac hợp văn phòng, còn Logitech G502 X Lightspeed hợp chơi game.";
  const mice = [{ name: "Chuột không dây Logitech MX Master 3S for Mac" }, { name: "Chuột Gaming Logitech G502 X Lightspeed" }];
  assert.equal(pickMentionedProducts(answer, mice).length, 2);
});

test("tìm không kèm điều kiện: model vẫn đọc được kết quả nhưng không gắn thẻ sản phẩm", async () => {
  // Cùng dạng với `shapeProduct` của aiRepository.
  aiRepository.searchProducts = async () => [
    { id: "p1", name: "Màn hình ViewSonic", price: 2390000, salePrice: null, inStock: true, specs: {} },
  ];

  const bare = await aiService.runTool({ name: "search_products", args: {} });
  assert.equal(bare.products.length, 0);
  assert.equal(bare.payload.count, 1);

  const filtered = await aiService.runTool({ name: "search_products", args: { brandNames: ["ViewSonic"] } });
  assert.equal(filtered.products.length, 1);
});
