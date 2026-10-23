// Test API danh sách mã giảm giá khách dùng được ở trang thanh toán.
// Chạy trên MySQL thật (DB techshop_discount_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let buyer;
let other;

const DAY = 86400000;

const available = (token, subtotal) => {
  const req = request(app).get("/api/v1/discounts/available");
  if (subtotal !== undefined) req.query({ subtotal });
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const codesOf = (res) => res.body.data.items.map((item) => item.code);

before(async () => {
  ({ app, db } = await startTestApi("discount"));

  const window = { startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) };

  await db.Discount.bulkCreate([
    { code: "SALE10", name: "Giảm 10%", discountType: "PERCENT", value: 10, maxDiscountAmount: 500000, ...window },
    { code: "BIG500K", name: "Giảm 500K", discountType: "FIXED", value: 500000, minOrderValue: 10000000, ...window },
    { code: "ONCE", name: "Một lần", discountType: "FIXED", value: 100000, usageLimitPerUser: 1, ...window },
    { code: "SOLDOUT", name: "Hết lượt", discountType: "FIXED", value: 100000, usageLimit: 2, usedCount: 2, ...window },
    { code: "PAUSED", name: "Tạm dừng", discountType: "FIXED", value: 100000, status: "PAUSED", ...window },
    {
      code: "OLD",
      name: "Hết hạn",
      discountType: "FIXED",
      value: 100000,
      startsAt: new Date(Date.now() - 3 * DAY),
      endsAt: new Date(Date.now() - DAY),
    },
    {
      code: "LATER",
      name: "Chưa tới ngày",
      discountType: "FIXED",
      value: 100000,
      startsAt: new Date(Date.now() + DAY),
      endsAt: new Date(Date.now() + 3 * DAY),
    },
  ]);

  buyer = await createCustomer(app, db, "buyer@example.com");
  other = await createCustomer(app, db, "other@example.com");

  // `buyer` đặt một đơn bằng ONCE nên đã hết lượt; `other` thì chưa.
  const category = await db.Category.create({ name: "Laptop", slug: "laptop" });
  const brand = await db.Brand.create({ name: "Asus", slug: "asus" });
  const laptop = await db.Product.create({
    categoryId: category.id,
    brandId: brand.id,
    status: "ACTIVE",
    name: "Asus Zenbook 14",
    slug: "zenbook-14",
    basePrice: 20000000,
    stockQuantity: 5,
  });
  const order = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${buyer.token}`)
    .set("Idempotency-Key", "discount-test-once")
    .send({
      addressId: buyer.addressId,
      paymentMethod: "COD",
      discountCode: "ONCE",
      items: [{ productId: laptop.id, quantity: 1 }],
    });
  assert.equal(order.status, 201);
});

after(async () => {
  await db.sequelize.close();
});

test("khách chưa đăng nhập không xem được danh sách mã, nhận 401", async () => {
  assert.equal((await available(null)).status, 401);
});

test("chỉ liệt kê mã đang chạy, còn lượt và khách chưa dùng hết lượt của mình", async () => {
  const mine = await available(buyer.token);
  assert.equal(mine.status, 200);
  assert.deepEqual(codesOf(mine).sort(), ["BIG500K", "SALE10"]);

  const theirs = await available(other.token);
  assert.deepEqual(codesOf(theirs).sort(), ["BIG500K", "ONCE", "SALE10"]);
});

test("có subtotal thì tính số tiền giảm, số tiền còn thiếu và đưa mã dùng được lên đầu", async () => {
  const res = await available(other.token, 2000000);
  const [first, ...rest] = res.body.data.items;

  assert.equal(first.code, "SALE10");
  assert.equal(first.eligible, true);
  assert.equal(first.discountAmount, 200000);

  const big = rest.find((item) => item.code === "BIG500K");
  assert.equal(big.eligible, false);
  assert.equal(big.shortfall, 8000000);
  assert.equal(big.discountAmount, 0);
  assert.equal(rest.at(-1).code, "BIG500K");
});

test("không gửi subtotal thì chưa đánh giá điều kiện đơn tối thiểu", async () => {
  const res = await available(other.token);

  assert.ok(res.body.data.items.every((item) => item.eligible === null));
});

test("subtotal không hợp lệ bị từ chối, nhận 400", async () => {
  assert.equal((await available(other.token, "abc")).status, 400);
});
