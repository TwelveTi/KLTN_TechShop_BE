// Test API sửa hồ sơ: avatar không được đặt bằng URL tự do qua PUT /users/me.
// Chạy trên MySQL thật (DB techshop_profile_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;

before(async () => {
  ({ app, db } = await startTestApi("profile"));
});

after(async () => {
  await db.sequelize.close();
});

test("PUT /users/me đổi được họ tên nhưng bỏ qua avatarUrl client gửi lên", async () => {
  const { user, token } = await createCustomer(app, db, "profile@example.com");

  const res = await request(app)
    .put("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({ fullName: "Nguyen Van Moi", avatarUrl: "https://attacker.example/pixel.png" })
    .expect(200);

  assert.equal(res.body.data.fullName, "Nguyen Van Moi");
  assert.equal(res.body.data.avatarUrl, null);

  const stored = await db.User.findByPk(user.id);
  assert.equal(stored.avatarUrl, null);
});
