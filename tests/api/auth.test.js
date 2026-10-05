// Test API luồng tài khoản: đăng ký, đăng nhập, refresh, đăng xuất.
// Chạy trên MySQL thật (DB techshop_auth_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;

const PASSWORD = "secret123";

// Lấy cookie refreshToken từ header Set-Cookie để gửi lại ở request sau.
const refreshCookieOf = (res) =>
  (res.headers["set-cookie"] || []).find((cookie) => cookie.startsWith("refreshToken="));

before(async () => {
  ({ app, db } = await startTestApi("auth"));
});

after(async () => {
  await db.sequelize.close();
});

test("đăng ký thành công nhưng KHÔNG đăng nhập luôn, mật khẩu được băm", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "An@Example.com ", password: PASSWORD, fullName: "Nguyen Van An" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, "an@example.com");
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(refreshCookieOf(res), undefined);

  const provider = await db.AuthProvider.findOne({ where: { providerEmail: "an@example.com" } });
  assert.notEqual(provider.passwordHash, PASSWORD);
  assert.match(provider.passwordHash, /^\$2[aby]\$/);
});

test("đăng ký trùng email bị từ chối 409", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "an@example.com", password: PASSWORD, fullName: "Nguyen Van An" });

  assert.equal(res.status, 409);
});

test("đăng ký với mật khẩu quá ngắn bị chặn ở validation", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "binh@example.com", password: "123", fullName: "Tran Binh" });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /Password/);
});

test("đăng ký bằng email dùng một lần bị từ chối", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "spam@mailinator.com", password: PASSWORD, fullName: "Spam Bot" });

  assert.equal(res.status, 400);
});

test("sai mật khẩu và email không tồn tại trả về cùng một thông báo", async () => {
  const wrongPassword = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "an@example.com", password: "wrongpass" });
  const unknownEmail = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "nobody@example.com", password: PASSWORD });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.message, unknownEmail.body.message);
});

test("đăng nhập trả access token và đặt refresh cookie HttpOnly", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "an@example.com", password: PASSWORD });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.match(refreshCookieOf(res), /HttpOnly/i);
  assert.equal(res.body.data.user.passwordHash, undefined);
});

test("route cần đăng nhập: không token 401, có token 200", async () => {
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "an@example.com", password: PASSWORD });

  const anonymous = await request(app).get("/api/v1/users/me");
  const signedIn = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`);

  assert.equal(anonymous.status, 401);
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.body.data.email, "an@example.com");
});

test("refresh cookie đổi được access token mới", async () => {
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "an@example.com", password: PASSWORD });

  const res = await request(app)
    .post("/api/v1/auth/refresh")
    .set("Cookie", refreshCookieOf(login));

  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
});

test("sau khi đăng xuất, refresh token cũ không dùng được nữa", async () => {
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "an@example.com", password: PASSWORD });
  const cookie = refreshCookieOf(login);

  const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
  assert.equal(logout.status, 200);

  const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
  assert.equal(refresh.status, 401);
});

test("đăng xuất thiết bị khác: phiên kia mất quyền, phiên hiện tại vẫn dùng được", async () => {
  const login = () =>
    request(app).post("/api/v1/auth/login").send({ email: "an@example.com", password: PASSWORD });
  const laptop = await login();
  const phone = await login();

  const revoke = await request(app)
    .post("/api/v1/auth/sessions/revoke-others")
    .set("Authorization", `Bearer ${laptop.body.data.accessToken}`)
    .set("Cookie", refreshCookieOf(laptop));
  assert.equal(revoke.status, 200);

  const phoneRefresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", refreshCookieOf(phone));
  const laptopRefresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", refreshCookieOf(laptop));
  assert.equal(phoneRefresh.status, 401);
  assert.equal(laptopRefresh.status, 200);
});
