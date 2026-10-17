// Test API khoá tài khoản theo số lần đăng nhập sai: khoá sau 5 lần, đang khoá thì
// mật khẩu đúng cũng bị chặn, hết hạn khoá thì đăng nhập lại được và bộ đếm được xoá.
// Chạy trên MySQL thật (DB techshop_lockout_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let victim;

const login = (password) => request(app).post("/api/v1/auth/login").send({ email: "victim@example.com", password });

before(async () => {
  ({ app, db } = await startTestApi("lockout"));
  victim = await createCustomer(app, db, "victim@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("4 lần sai đầu chỉ báo sai mật khẩu, lần thứ 5 khoá tài khoản", async () => {
  for (let i = 1; i <= 4; i += 1) {
    const res = await login("sai-mat-khau");
    assert.equal(res.status, 401, `lần sai thứ ${i}`);
  }

  const fifth = await login("sai-mat-khau");
  assert.equal(fifth.status, 429);
  assert.match(fifth.body.message, /Try again in 15 minute/);
});

test("đang khoá thì mật khẩu đúng cũng bị chặn", async () => {
  const res = await login("secret123");
  assert.equal(res.status, 429);
});

test("hết hạn khoá thì đăng nhập đúng vào được và bộ đếm bị xoá", async () => {
  await db.LoginLockout.update({ lockedUntil: new Date(Date.now() - 1000) }, { where: { userId: victim.user.id } });

  const res = await login("secret123");
  assert.equal(res.status, 200);
  assert.equal(await db.LoginLockout.count({ where: { userId: victim.user.id } }), 0);
});

test("email không tồn tại không tạo bản ghi khoá, vẫn chỉ báo sai chung chung", async () => {
  const res = await request(app).post("/api/v1/auth/login").send({ email: "khong-co@example.com", password: "sai-mat-khau" });
  assert.equal(res.status, 401);
  assert.equal(await db.LoginLockout.count(), 0);
});
