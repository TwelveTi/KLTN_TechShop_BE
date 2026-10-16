// Test API quản lý biến thể: thêm, sửa, xoá từng cái, giữ đúng một biến thể mặc định,
// và tồn kho sản phẩm luôn bằng tổng tồn kho các biến thể, kể cả khi đặt và huỷ đơn.
// Chạy trên MySQL thật (DB techshop_variant_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let adminToken;
let phone;
let buyer;
const ids = {};

const asAdmin = (req) => req.set("Authorization", `Bearer ${adminToken}`);
const base = () => `/api/v1/admin/products/${phone.id}/variants`;
const productStock = async () => (await db.Product.findByPk(phone.id)).stockQuantity;
const defaults = async () => (await db.ProductVariant.findAll({ where: { productId: phone.id, isDefault: true } })).map((v) => v.id);

before(async () => {
  ({ app, db } = await startTestApi("variant"));

  const category = await db.Category.create({ name: "Điện thoại", slug: "dien-thoai" });
  const brand = await db.Brand.create({ name: "Apple", slug: "apple" });
  phone = await db.Product.create({
    categoryId: category.id,
    brandId: brand.id,
    status: "ACTIVE",
    name: "iPhone 15 Pro Max",
    slug: "iphone-15-pro-max",
    sku: "IP15PM",
    basePrice: 34990000,
    stockQuantity: 0,
  });

  const userService = require("../../src/services/userService");
  await userService.provisionUser({ email: "admin@example.com", password: "secret123", fullName: "Admin", role: "ADMIN", emailVerifiedAt: new Date() });
  adminToken = (await request(app).post("/api/v1/auth/login").send({ email: "admin@example.com", password: "secret123" })).body.data.accessToken;
  buyer = await createCustomer(app, db, "buyer@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("biến thể đầu tiên tự thành mặc định, SKU tự sinh, tồn kho sản phẩm bằng tổng", async () => {
  const res = await asAdmin(request(app).post(base())).send({ variantName: "256GB", stockQuantity: 25 });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.isDefault, true);
  assert.equal(res.body.data.sku, "IP15PM-V1");
  ids.v256 = res.body.data.id;
  assert.equal(await productStock(), 25);
});

test("thêm biến thể mặc định mới thì biến thể cũ mất cờ mặc định", async () => {
  const res = await asAdmin(request(app).post(base())).send({
    variantName: "512GB",
    price: 40990000,
    salePrice: 35990000,
    stockQuantity: 10,
    isDefault: true,
  });

  assert.equal(res.status, 201);
  ids.v512 = res.body.data.id;
  assert.deepEqual(await defaults(), [ids.v512]);
  assert.equal(await productStock(), 35);
});

test("sửa tồn kho giữ nguyên id và đồng bộ tồn kho sản phẩm; giá sale không được cao hơn giá", async () => {
  const ok = await asAdmin(request(app).put(`${base()}/${ids.v256}`)).send({ stockQuantity: 40 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.id, ids.v256);
  assert.equal(await productStock(), 50);

  const bad = await asAdmin(request(app).put(`${base()}/${ids.v512}`)).send({ salePrice: 50000000 });
  assert.equal(bad.status, 400);
});

test("SKU trùng bị từ chối", async () => {
  const res = await asAdmin(request(app).post(base())).send({ variantName: "1TB", sku: "IP15PM-V1" });
  assert.equal(res.status, 409);
});

test("đặt và huỷ đơn trên biến thể thì tồn kho sản phẩm đi theo", async () => {
  const order = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${buyer.token}`)
    .send({ addressId: buyer.addressId, paymentMethod: "COD", items: [{ productId: phone.id, variantId: ids.v512, quantity: 2 }] });

  assert.equal(order.status, 201);
  assert.equal(order.body.data.items[0].unitPrice, 35990000);
  assert.equal(await productStock(), 48);

  const cancel = await request(app)
    .patch(`/api/v1/orders/${order.body.data.id}/cancel`)
    .set("Authorization", `Bearer ${buyer.token}`)
    .send({});
  assert.equal(cancel.status, 200);
  assert.equal(await productStock(), 50);
});

test("xoá biến thể mặc định: xoá mềm, dòng giỏ hàng bị bỏ, biến thể khác nhận cờ mặc định", async () => {
  await request(app)
    .post("/api/v1/cart/items")
    .set("Authorization", `Bearer ${buyer.token}`)
    .send({ productId: phone.id, variantId: ids.v512, quantity: 1 });
  assert.equal(await db.CartItem.count({ where: { variantId: ids.v512 } }), 1);

  const res = await asAdmin(request(app).delete(`${base()}/${ids.v512}`));
  assert.equal(res.status, 200);

  assert.equal(await db.CartItem.count({ where: { variantId: ids.v512 } }), 0);
  assert.ok(await db.ProductVariant.findByPk(ids.v512, { paranoid: false }), "biến thể vẫn còn, chỉ bị xoá mềm");
  assert.deepEqual(await defaults(), [ids.v256]);
  assert.equal(await productStock(), 40);
});

test("biến thể không thuộc sản phẩm thì trả 404", async () => {
  const other = await db.Product.create({ ...phone.get({ plain: true }), id: undefined, slug: "khac", sku: "KHAC", name: "Khác" });
  const res = await asAdmin(request(app).put(`/api/v1/admin/products/${other.id}/variants/${ids.v256}`)).send({ stockQuantity: 1 });
  assert.equal(res.status, 404);
});
