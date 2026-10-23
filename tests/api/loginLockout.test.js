// Test API khoá đăng nhập theo số lần sai: khoá sau 5 lần, đang khoá thì mật khẩu đúng cũng bị chặn,
// hết hạn khoá thì đăng nhập lại được và bộ đếm được xoá. Khoá tính theo email nên email không tồn tại
// bị đối xử y hệt, không ai dò được email nào đã đăng ký.
// Chạy trên MySQL thật (DB techshop_lockout_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { startTestApi, createCustomer } = require("./setup");
const { loginLockoutKey } = require("../../src/utils/tokenHash");

let app;
let db;

const loginAs = (email, password) => request(app).post("/api/v1/auth/login").send({ email, password });
const login = (password) => loginAs("victim@example.com", password);

// Gửi `n` lần sai mật khẩu, trả về mã HTTP của từng lần.
const failTimes = async (email, n) => {
  const statuses = [];
  for (let i = 0; i < n; i += 1) {
    statuses.push((await loginAs(email, "sai-mat-khau")).status);
  }
  return statuses;
};

before(async () => {
  ({ app, db } = await startTestApi("lockout"));
  await createCustomer(app, db, "victim@example.com");
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
  const emailKey = loginLockoutKey("victim@example.com");
  await db.LoginLockout.update({ lockedUntil: new Date(Date.now() - 1000) }, { where: { emailKey } });

  const res = await login("secret123");
  assert.equal(res.status, 200);
  assert.equal(await db.LoginLockout.count({ where: { emailKey } }), 0);
});

test("email không tồn tại bị khoá y hệt tài khoản thật: cùng chuỗi mã lỗi, cùng thông báo", async () => {
  await createCustomer(app, db, "real@example.com");

  const real = await failTimes("real@example.com", 6);
  const ghost = await failTimes("ghost@example.com", 6);

  assert.deepEqual(real, [401, 401, 401, 401, 429, 429]);
  assert.deepEqual(ghost, real);

  const realLocked = await loginAs("real@example.com", "sai-mat-khau");
  const ghostLocked = await loginAs("ghost@example.com", "sai-mat-khau");
  assert.equal(ghostLocked.body.message, realLocked.body.message);
});

test("bảng khoá chỉ lưu hash của email, không lưu email thô", async () => {
  const row = await db.LoginLockout.findByPk(loginLockoutKey("ghost@example.com"));
  assert.ok(row);
  assert.match(row.emailKey, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(row.get({ plain: true })).includes("ghost@example.com"), false);
});

test("email không tồn tại vẫn chạy bcrypt, nên thời gian phản hồi không lộ tài khoản", async (t) => {
  const compare = t.mock.method(bcrypt, "compare");

  const res = await loginAs("nobody-timing@example.com", "sai-mat-khau");

  assert.equal(res.status, 401);
  assert.equal(compare.mock.callCount(), 1);
  assert.match(compare.mock.calls[0].arguments[1], /^\$2[aby]\$/);
});

test("đặt lại mật khẩu gỡ khoá đăng nhập của đúng email đó", async () => {
  await createCustomer(app, db, "reset@example.com");
  await failTimes("reset@example.com", 5);
  const user = await db.User.findOne({ where: { email: "reset@example.com" } });

  const passwordRepository = require("../../src/repositories/passwordRepository");
  await passwordRepository.clearLoginLockout(user.id);

  assert.equal(await db.LoginLockout.count({ where: { emailKey: loginLockoutKey("reset@example.com") } }), 0);
  assert.equal((await loginAs("reset@example.com", "secret123")).status, 200);
});
