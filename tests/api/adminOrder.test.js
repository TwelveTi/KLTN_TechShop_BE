// Test API admin đổi trạng thái đơn: huỷ đơn phải hoàn kho và trả lượt dùng mã giảm giá.
// Chạy trên MySQL thật (DB techshop_adminorder_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let adminToken;
let buyer;
let laptop;
let discount;

const stockOf = async () => (await db.Product.findByPk(laptop.id)).stockQuantity;

// Mỗi lần một key riêng, nếu không lần đặt sau trùng giỏ sẽ bị coi là gửi lại đơn cũ.
let orderSeq = 0;
const placeOrder = () =>
  request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${buyer.token}`)
    .set("Idempotency-Key", `admin-order-test-${++orderSeq}`)
    .send({
      addressId: buyer.addressId,
      paymentMethod: "COD",
      discountCode: "SALE10",
      items: [{ productId: laptop.id, quantity: 1 }],
    });

const setStatus = (orderId, status) =>
  request(app)
    .patch(`/api/v1/admin/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status });

before(async () => {
  ({ app, db } = await startTestApi("adminorder"));

  const userService = require("../../src/services/userService");
  await userService.provisionUser({
    email: "admin@example.com",
    password: "secret123",
    fullName: "Admin",
    role: "ADMIN",
    emailVerifiedAt: new Date(),
  });
  const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@example.com", password: "secret123" });
  adminToken = login.body.data.accessToken;

  const category = await db.Category.create({ name: "Laptop", slug: "laptop" });
  const brand = await db.Brand.create({ name: "Asus", slug: "asus" });
  laptop = await db.Product.create({
    categoryId: category.id,
    brandId: brand.id,
    status: "ACTIVE",
    name: "Asus Zenbook 14",
    slug: "zenbook-14",
    basePrice: 20000000,
    stockQuantity: 5,
  });

  // Mỗi khách chỉ được dùng một lần, để thấy rõ lượt dùng có được trả lại hay không.
  discount = await db.Discount.create({
    code: "SALE10",
    name: "Giảm 10%",
    discountType: "PERCENT",
    value: 10,
    usageLimitPerUser: 1,
    startsAt: new Date(Date.now() - 86400000),
    endsAt: new Date(Date.now() + 86400000),
    status: "ACTIVE",
  });

  buyer = await createCustomer(app, db, "buyer@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("admin huỷ đơn: hoàn kho, trả lượt dùng mã, khách dùng lại được mã", async () => {
  const order = await placeOrder();
  assert.equal(order.status, 201);
  assert.equal(order.body.data.discountAmount, 2000000);
  assert.equal(await stockOf(), 4);
  assert.equal((await discount.reload()).usedCount, 1);

  // Chưa huỷ thì mã đã hết lượt cho khách này.
  const blocked = await placeOrder();
  assert.equal(blocked.status, 409);

  const cancel = await setStatus(order.body.data.id, "CANCELLED");
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.status, "CANCELLED");
  assert.equal(await stockOf(), 5);
  assert.equal((await discount.reload()).usedCount, 0);

  const usage = await db.DiscountUsage.findOne({ where: { orderId: order.body.data.id } });
  assert.ok(usage.releasedAt, "lượt dùng mã phải được đánh dấu đã trả");

  const again = await placeOrder();
  assert.equal(again.status, 201);
  assert.equal((await discount.reload()).usedCount, 1);
});

test("huỷ lần hai bị từ chối, kho và lượt dùng mã không bị trả thêm", async () => {
  const order = await placeOrder();
  // Lượt trước của test trên vẫn đang giữ mã, nên đơn này không dùng được mã.
  assert.equal(order.status, 409);

  const existing = await db.Order.findOne({ where: { status: "PENDING" } });
  const stockBefore = await stockOf();

  const first = await setStatus(existing.id, "CANCELLED");
  assert.equal(first.status, 200);
  assert.equal(await stockOf(), stockBefore + 1);
  assert.equal((await discount.reload()).usedCount, 0);

  const second = await setStatus(existing.id, "CANCELLED");
  assert.equal(second.status, 409);
  assert.equal(await stockOf(), stockBefore + 1);
  assert.equal((await discount.reload()).usedCount, 0);
});
