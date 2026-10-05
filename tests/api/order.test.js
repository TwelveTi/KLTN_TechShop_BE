// Test API đặt hàng và huỷ đơn: giá tính ở server, giữ tồn kho, chống đặt trùng.
// Chạy trên MySQL thật (DB techshop_order_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let laptop;
let mouse;
let buyer;
let stranger;

const placeOrder = (customer, body, idempotencyKey) => {
  const req = request(app).post("/api/v1/orders").set("Authorization", `Bearer ${customer.token}`);
  if (idempotencyKey) req.set("Idempotency-Key", idempotencyKey);
  return req.send({ addressId: customer.addressId, paymentMethod: "COD", ...body });
};

const stockOf = async (product) => (await db.Product.findByPk(product.id)).stockQuantity;

before(async () => {
  ({ app, db } = await startTestApi("order"));

  const category = await db.Category.create({ name: "Laptop", slug: "laptop" });
  const brand = await db.Brand.create({ name: "Asus", slug: "asus" });
  const product = (fields) =>
    db.Product.create({ categoryId: category.id, brandId: brand.id, status: "ACTIVE", ...fields });

  laptop = await product({ name: "Asus Zenbook 14", slug: "zenbook-14", basePrice: 25000000, salePrice: 22000000, stockQuantity: 5 });
  mouse = await product({ name: "Chuot khong day", slug: "chuot", basePrice: 200000, stockQuantity: 50 });

  buyer = await createCustomer(app, db, "buyer@example.com");
  stranger = await createCustomer(app, db, "stranger@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("đặt hàng COD: giá lấy từ DB, miễn phí ship trên 1 triệu, trừ tồn kho", async () => {
  // unitPrice gửi lên là giá giả, server phải bỏ qua.
  const res = await placeOrder(buyer, {
    items: [{ productId: laptop.id, quantity: 2, unitPrice: 1 }],
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "PENDING");
  assert.equal(res.body.data.items[0].unitPrice, 22000000);
  assert.equal(res.body.data.subtotalPrice, 44000000);
  assert.equal(res.body.data.shippingFee, 0);
  assert.equal(res.body.data.totalPrice, 44000000);
  assert.equal(await stockOf(laptop), 3);

  const payment = await db.Payment.findOne({ where: { orderId: res.body.data.id } });
  assert.equal(payment.paymentMethod, "COD");
});

test("đơn dưới 1 triệu bị tính phí ship 30.000đ", async () => {
  const res = await placeOrder(buyer, { items: [{ productId: mouse.id, quantity: 1 }] });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.shippingFee, 30000);
  assert.equal(res.body.data.totalPrice, 230000);
});

test("gửi lại cùng Idempotency-Key trả về đúng đơn cũ, không trừ kho lần hai", async () => {
  const body = { items: [{ productId: mouse.id, quantity: 3 }] };
  const stockBefore = await stockOf(mouse);

  const first = await placeOrder(buyer, body, "checkout-abc-123");
  const retry = await placeOrder(buyer, body, "checkout-abc-123");

  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.id, first.body.data.id);
  assert.equal(await stockOf(mouse), stockBefore - 3);
});

test("đặt quá số tồn kho bị từ chối 409 và kho giữ nguyên", async () => {
  const res = await placeOrder(buyer, { items: [{ productId: laptop.id, quantity: 10 }] });

  assert.equal(res.status, 409);
  assert.equal(await stockOf(laptop), 3);
});

test("tài khoản chưa xác thực email không được đặt hàng", async () => {
  const unverified = await createCustomer(app, db, "unverified@example.com", { verified: false });

  const res = await placeOrder(unverified, { items: [{ productId: mouse.id, quantity: 1 }] });

  assert.equal(res.status, 403);
});

test("không dùng được địa chỉ giao hàng của người khác", async () => {
  const res = await placeOrder(buyer, {
    addressId: stranger.addressId,
    items: [{ productId: mouse.id, quantity: 1 }],
  });

  assert.equal(res.status, 404);
});

test("huỷ đơn PENDING hoàn lại tồn kho, huỷ lần hai bị từ chối", async () => {
  const order = await placeOrder(buyer, { items: [{ productId: laptop.id, quantity: 1 }] });
  assert.equal(await stockOf(laptop), 2);

  const cancel = () =>
    request(app)
      .patch(`/api/v1/orders/${order.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ reason: "Doi y" });

  const first = await cancel();
  assert.equal(first.status, 200);
  assert.equal(first.body.data.status, "CANCELLED");
  assert.equal(await stockOf(laptop), 3);

  const second = await cancel();
  assert.equal(second.status, 409);
  assert.equal(await stockOf(laptop), 3);
});

test("người khác không huỷ được đơn của mình", async () => {
  const order = await placeOrder(buyer, { items: [{ productId: mouse.id, quantity: 1 }] });

  const res = await request(app)
    .patch(`/api/v1/orders/${order.body.data.id}/cancel`)
    .set("Authorization", `Bearer ${stranger.token}`)
    .send({});

  assert.equal(res.status, 404);
});

test("danh sách đơn của tôi chỉ chứa đơn của chính mình", async () => {
  const res = await request(app).get("/api/v1/orders/me").set("Authorization", `Bearer ${stranger.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.orders.length, 0);
});
