// Test API tìm kiếm: ô tìm sản phẩm khớp từng từ theo tên, hãng và danh mục;
// danh sách user của admin lọc được theo từ khoá, vai trò và trạng thái.
// Chạy trên MySQL thật (DB techshop_search_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let token;

const names = (res) => res.body.data.items.map((item) => item.name).sort();
const search = (keyword) => request(app).get("/api/v1/products").query({ keyword, limit: 50 });
const users = (query) => request(app).get("/api/v1/admin/users").query(query).set("Authorization", `Bearer ${token}`);

before(async () => {
  ({ app, db } = await startTestApi("search"));

  const audio = await db.Category.create({ name: "Âm Thanh & Tai Nghe", slug: "am-thanh" });
  const headphones = await db.Category.create({ name: "Tai Nghe", slug: "tai-nghe", parentId: audio.id });
  const speakers = await db.Category.create({ name: "Loa", slug: "loa", parentId: audio.id });
  const phones = await db.Category.create({ name: "Điện Thoại", slug: "dien-thoai" });
  const sony = await db.Brand.create({ name: "Sony", slug: "sony" });
  const jbl = await db.Brand.create({ name: "JBL", slug: "jbl" });
  const apple = await db.Brand.create({ name: "Apple", slug: "apple" });

  const make = (category, brand, name) =>
    db.Product.create({
      categoryId: category.id,
      brandId: brand.id,
      status: "ACTIVE",
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      basePrice: 5000000,
      stockQuantity: 5,
    });
  await make(headphones, sony, "WH-1000XM5");
  await make(headphones, jbl, "Tune 520BT");
  await make(speakers, jbl, "Go 4");
  await make(phones, apple, "iPhone 15");

  const userService = require("../../src/services/userService");
  await userService.provisionUser({ email: "boss@example.com", password: "secret123", fullName: "Boss", role: "ADMIN", emailVerifiedAt: new Date() });
  await userService.provisionUser({ email: "lan@example.com", password: "secret123", fullName: "Nguyen Lan", emailVerifiedAt: new Date() });
  const blocked = await userService.provisionUser({ email: "minh@example.com", password: "secret123", fullName: "Tran Minh", emailVerifiedAt: new Date() });
  await db.User.update({ status: "BLOCKED" }, { where: { id: blocked.id } });

  const login = await request(app).post("/api/v1/auth/login").send({ email: "boss@example.com", password: "secret123" });
  token = login.body.data.accessToken;
});

after(async () => {
  await db.sequelize.close();
});

test("từ khoá nhiều từ khớp theo hãng và danh mục dù tên sản phẩm không chứa", async () => {
  assert.deepEqual(names(await search("tai nghe sony")), ["WH-1000XM5"]);
  assert.deepEqual(names(await search("sony tai nghe")), ["WH-1000XM5"]);
});

test("danh mục cha và con cùng khớp thì chỉ lấy con, không kéo loa vào kết quả tai nghe", async () => {
  assert.deepEqual(names(await search("tai nghe")), ["Tune 520BT", "WH-1000XM5"]);
});

test("gõ không dấu vẫn khớp tên danh mục có dấu", async () => {
  assert.deepEqual(names(await search("dien thoai")), ["iPhone 15"]);
});

test("từ khoá vô nghĩa trả về rỗng", async () => {
  assert.equal((await search("xyzqwe")).body.data.items.length, 0);
});

test("admin lọc user theo từ khoá, vai trò và trạng thái", async () => {
  const byKeyword = await users({ q: "lan@" });
  assert.equal(byKeyword.status, 200);
  assert.deepEqual(byKeyword.body.data.items.map((u) => u.email), ["lan@example.com"]);

  const admins = await users({ role: "ADMIN" });
  assert.deepEqual(admins.body.data.items.map((u) => u.email), ["boss@example.com"]);

  const blocked = await users({ status: "BLOCKED" });
  assert.deepEqual(blocked.body.data.items.map((u) => u.email), ["minh@example.com"]);
});
