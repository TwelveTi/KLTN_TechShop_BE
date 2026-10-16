// Test API xoá danh mục và thương hiệu: còn sản phẩm hoặc danh mục con thì phải từ chối,
// vì xoá mềm không kích hoạt RESTRICT của khoá ngoại và sẽ để lại sản phẩm mồ côi.
// Chạy trên MySQL thật (DB techshop_taxonomy_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let token;
let parent;
let child;
let empty;
let usedBrand;
let unusedBrand;

const del = (path) => request(app).delete(`/api/v1/admin/${path}`).set("Authorization", `Bearer ${token}`);

before(async () => {
  ({ app, db } = await startTestApi("taxonomy"));

  parent = await db.Category.create({ name: "Âm thanh", slug: "am-thanh" });
  child = await db.Category.create({ name: "Tai nghe", slug: "tai-nghe", parentId: parent.id });
  empty = await db.Category.create({ name: "Trống", slug: "trong" });
  usedBrand = await db.Brand.create({ name: "Sony", slug: "sony" });
  unusedBrand = await db.Brand.create({ name: "Không dùng", slug: "khong-dung" });
  await db.Product.create({
    categoryId: child.id,
    brandId: usedBrand.id,
    status: "ACTIVE",
    name: "WH-1000XM5",
    slug: "wh-1000xm5",
    basePrice: 8000000,
    stockQuantity: 3,
  });

  const userService = require("../../src/services/userService");
  await userService.provisionUser({ email: "admin@example.com", password: "secret123", fullName: "Admin", role: "ADMIN", emailVerifiedAt: new Date() });
  const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@example.com", password: "secret123" });
  token = login.body.data.accessToken;
});

after(async () => {
  await db.sequelize.close();
});

test("không xoá được danh mục còn sản phẩm", async () => {
  const res = await del(`categories/${child.id}`);
  assert.equal(res.status, 409);
  assert.ok(await db.Category.findByPk(child.id));
});

test("không xoá được danh mục cha còn danh mục con, dù bản thân nó không có sản phẩm", async () => {
  const res = await del(`categories/${parent.id}`);
  assert.equal(res.status, 409);
});

test("danh mục trống thì xoá được", async () => {
  assert.equal((await del(`categories/${empty.id}`)).status, 200);
});

test("không xoá được thương hiệu còn sản phẩm, thương hiệu trống thì được", async () => {
  assert.equal((await del(`brands/${usedBrand.id}`)).status, 409);
  assert.equal((await del(`brands/${unusedBrand.id}`)).status, 200);
});
