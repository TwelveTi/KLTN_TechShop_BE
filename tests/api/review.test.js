// Test API review: ai đăng nhập cũng review được, nhưng chỉ người đã nhận hàng có nhãn "Verified purchase".
// Chạy trên MySQL thật (DB techshop_review_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let headphone;
let speaker;

const placeOrder = (customer, productId) =>
  request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${customer.token}`)
    .send({ addressId: customer.addressId, paymentMethod: "COD", items: [{ productId, quantity: 1 }] });

const review = (customer, productId, rating = 5) =>
  request(app)
    .post(`/api/v1/products/${productId}/reviews`)
    .set("Authorization", `Bearer ${customer.token}`)
    .send({ rating, title: "Dung tot", content: "San pham dung on dinh sau mot tuan." });

before(async () => {
  ({ app, db } = await startTestApi("review"));

  const category = await db.Category.create({ name: "Tai nghe", slug: "tai-nghe" });
  const brand = await db.Brand.create({ name: "Sony", slug: "sony" });
  const product = (fields) =>
    db.Product.create({ categoryId: category.id, brandId: brand.id, status: "ACTIVE", stockQuantity: 10, ...fields });

  headphone = await product({ name: "Sony WH-1000XM5", slug: "wh-1000xm5", basePrice: 7990000 });
  speaker = await product({ name: "Sony SRS-XB100", slug: "srs-xb100", basePrice: 1290000 });
});

after(async () => {
  await db.sequelize.close();
});

test("đã nhận hàng thì review được gắn nhãn Verified purchase", async () => {
  const buyer = await createCustomer(app, db, "buyer@example.com");
  const order = await placeOrder(buyer, headphone.id);
  await db.Order.update({ status: "DELIVERED" }, { where: { id: order.body.data.id } });

  const res = await review(buyer, headphone.id);

  assert.equal(res.status, 201);
  assert.equal(res.body.data.verifiedPurchase, true);
});

test("chưa mua vẫn review được nhưng không có nhãn", async () => {
  const visitor = await createCustomer(app, db, "visitor@example.com");

  const res = await review(visitor, headphone.id, 3);

  assert.equal(res.status, 201);
  assert.equal(res.body.data.verifiedPurchase, false);
});

test("đơn chưa giao thì chưa tính là đã mua", async () => {
  const waiting = await createCustomer(app, db, "waiting@example.com");
  await placeOrder(waiting, speaker.id);

  const res = await review(waiting, speaker.id);

  assert.equal(res.status, 201);
  assert.equal(res.body.data.verifiedPurchase, false);
});

test("mỗi người chỉ review một lần cho một sản phẩm", async () => {
  const repeat = await createCustomer(app, db, "repeat@example.com");
  await review(repeat, speaker.id);

  const res = await review(repeat, speaker.id);

  assert.equal(res.status, 409);
});

test("điểm trung bình của sản phẩm được tính lại sau mỗi review", async () => {
  const summary = await request(app).get(`/api/v1/products/${headphone.id}/reviews/summary`);

  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.totalReviews, 2);
  assert.equal(summary.body.data.averageRating, 4);
});
