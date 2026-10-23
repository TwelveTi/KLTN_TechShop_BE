// Test API: admin không được tự hạ quyền, tự khoá hay tự xoá mình, nên hệ thống không mất admin cuối.
// Chạy trên MySQL thật (DB techshop_admin_self_guard_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let admin;
let token;

const PASSWORD = "Admin1234";

async function createAdmin(email) {
  const userService = require("../../src/services/userService");
  const user = await userService.provisionUser({
    email,
    password: PASSWORD,
    fullName: "Admin",
    role: "ADMIN",
    emailVerifiedAt: new Date(),
  });
  const login = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  return { user, token: login.body.data.accessToken };
}

const putUser = (id, body) =>
  request(app).put(`/api/v1/admin/users/${id}`).set("Authorization", `Bearer ${token}`).send(body);

before(async () => {
  ({ app, db } = await startTestApi("admin_self_guard"));
  ({ user: admin, token } = await createAdmin("root-admin@example.com"));
});

after(async () => {
  await db.sequelize.close();
});

test("admin không tự hạ mình xuống CUSTOMER được", async () => {
  const res = await putUser(admin.id, { role: "CUSTOMER" });
  assert.equal(res.status, 409);
  assert.equal((await db.User.findByPk(admin.id)).role, "ADMIN");
});

test("admin không tự khoá hay tự vô hiệu hoá mình được", async () => {
  for (const status of ["BLOCKED", "INACTIVE"]) {
    const res = await putUser(admin.id, { status });
    assert.equal(res.status, 409, status);
  }
  assert.equal((await db.User.findByPk(admin.id)).status, "ACTIVE");
});

test("admin không tự xoá mình được", async () => {
  const res = await request(app).delete(`/api/v1/admin/users/${admin.id}`).set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 409);
  assert.ok(await db.User.findByPk(admin.id));
});

test("admin vẫn sửa được thông tin khác của chính mình", async () => {
  const res = await putUser(admin.id, { fullName: "Root Admin", role: "ADMIN", status: "ACTIVE" });
  assert.equal(res.status, 200);
  assert.equal((await db.User.findByPk(admin.id)).fullName, "Root Admin");
});

test("admin vẫn hạ quyền, khoá và xoá được admin KHÁC", async () => {
  const { user: other } = await createAdmin("second-admin@example.com");

  assert.equal((await putUser(other.id, { role: "CUSTOMER" })).status, 200);
  assert.equal((await putUser(other.id, { status: "BLOCKED" })).status, 200);
  const del = await request(app).delete(`/api/v1/admin/users/${other.id}`).set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 200);
});
