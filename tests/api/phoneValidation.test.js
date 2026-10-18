// Test API kiểm định dạng số điện thoại ở đăng ký, hồ sơ và sổ địa chỉ.
// Chạy trên MySQL thật (DB techshop_phone_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let customer;

const address = (receiverPhone) => ({
  receiverName: "Nguyen Van An",
  receiverPhone,
  province: "TP Ho Chi Minh",
  district: "Quan 1",
  ward: "Ben Nghe",
  addressLine: "1 Le Loi",
});

before(async () => {
  ({ app, db } = await startTestApi("phone"));
  customer = await createCustomer(app, db, "phone@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("đăng ký với số điện thoại sai định dạng bị từ chối", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "new@example.com", password: "Secret123", fullName: "Nguoi Moi", phone: "abc" });

  assert.equal(res.status, 400);
});

test("hồ sơ nhận số hợp lệ và từ chối số sai định dạng", async () => {
  const update = (phone) =>
    request(app).put("/api/v1/users/me").set("Authorization", `Bearer ${customer.token}`).send({ phone });

  assert.equal((await update("12345")).status, 400);
  assert.equal((await update("0912345678")).status, 200);
  assert.equal((await update("+84912345678")).status, 200);
});

test("địa chỉ giao hàng từ chối số điện thoại người nhận sai định dạng", async () => {
  const create = (phone) =>
    request(app).post("/api/v1/addresses/me").set("Authorization", `Bearer ${customer.token}`).send(address(phone));

  assert.equal((await create("not-a-phone")).status, 400);
  assert.equal((await create("0987654321")).status, 201);
});

test("địa chỉ theo đơn vị hành chính mới không cần quận/huyện", async () => {
  const { district, ...withoutDistrict } = address("0912345678");
  assert.ok(district);

  const res = await request(app)
    .post("/api/v1/addresses/me")
    .set("Authorization", `Bearer ${customer.token}`)
    .send({ ...withoutDistrict, province: "Thành phố Hồ Chí Minh", ward: "Phường Sài Gòn" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.district, "");
});
