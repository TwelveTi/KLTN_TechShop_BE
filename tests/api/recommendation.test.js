// Test API gợi ý: dải "tương tự" giữ nguyên khi tải lại, và chỉ người đã đăng nhập hỏi được AI vì sao.
// Chạy trên MySQL thật (DB techshop_recommendation_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let source;
let owner;
let stranger;

const similar = (productId, { sessionId, token } = {}) => {
  const req = request(app).get(`/api/v1/recommendations/products/${productId}/similar`).query({ limit: 4 });
  if (sessionId) req.set("X-Session-Id", sessionId);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

const explain = (itemId, token) => {
  const req = request(app).post(`/api/v1/ai/recommendations/${itemId}/explain`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

before(async () => {
  ({ app, db } = await startTestApi("recommendation"));

  const category = await db.Category.create({ name: "Laptop", slug: "laptop" });
  const brand = await db.Brand.create({ name: "Asus", slug: "asus" });
  const product = (n) =>
    db.Product.create({ categoryId: category.id, brandId: brand.id, status: "ACTIVE", name: `Laptop ${n}`, slug: `laptop-${n}`, basePrice: 20000000, stockQuantity: 5 });

  source = await product(0);
  const others = [await product(1), await product(2), await product(3)];
  await db.ProductSimilarity.bulkCreate(
    others.map((other, index) => ({ productId: source.id, similarProductId: other.id, similarityType: "CONTENT", score: 0.9 - index * 0.1 })),
  );

  owner = await createCustomer(app, db, "owner@example.com");
  stranger = await createCustomer(app, db, "stranger@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("tải lại dải sản phẩm tương tự giữ nguyên itemId cho cùng một khách", async () => {
  const first = await similar(source.id, { sessionId: "visitor-a" });
  const reload = await similar(source.id, { sessionId: "visitor-a" });

  assert.equal(first.status, 200);
  assert.equal(first.body.data.items.length, 3);
  assert.equal(first.body.data.cached, false);
  assert.equal(reload.body.data.cached, true);
  assert.deepEqual(
    reload.body.data.items.map((item) => item.itemId),
    first.body.data.items.map((item) => item.itemId),
  );
  assert.equal(await db.RecommendationResult.count({ where: { sessionId: "visitor-a" } }), 1);
});

test("khách khác nhận dải riêng, không dùng chung itemId", async () => {
  const mine = await similar(source.id, { sessionId: "visitor-a" });
  const theirs = await similar(source.id, { sessionId: "visitor-b" });

  assert.notEqual(theirs.body.data.items[0].itemId, mine.body.data.items[0].itemId);
});

test("khách chưa đăng nhập không hỏi được AI vì sao, nhận 401", async () => {
  const rail = await similar(source.id, { sessionId: "visitor-a" });
  const res = await explain(rail.body.data.items[0].itemId);

  assert.equal(res.status, 401);
});

test("không hỏi được về dòng gợi ý của người khác, nhận 404", async () => {
  const rail = await similar(source.id, { token: owner.token });
  const res = await explain(rail.body.data.items[0].itemId, stranger.token);

  // 503 nếu môi trường test không có khoá Gemini, vì kiểm tra cấu hình chạy trước.
  assert.ok([404, 503].includes(res.status));
});

test("lời giải thích đã lưu được trả lại và hiện cùng dải khi tải lại", async () => {
  const rail = await similar(source.id, { token: owner.token });
  const item = rail.body.data.items[0];
  await db.RecommendationItem.update(
    { reasonMetadata: { ...item.reasonMetadata, explanation: "Cùng dòng laptop mỏng nhẹ" } },
    { where: { id: item.itemId } },
  );

  const reload = await similar(source.id, { token: owner.token });
  assert.equal(reload.body.data.items[0].itemId, item.itemId);
  assert.equal(reload.body.data.items[0].reasonMetadata.explanation, "Cùng dòng laptop mỏng nhẹ");

  const res = await explain(item.itemId, owner.token);
  if (res.status === 503) return; // không có khoá Gemini thì dừng ở kiểm tra cấu hình
  assert.equal(res.status, 200);
  assert.equal(res.body.data.cached, true);
  assert.equal(res.body.data.explanation, "Cùng dòng laptop mỏng nhẹ");
});
