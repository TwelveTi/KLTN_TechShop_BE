// Test API gắn Google vào tài khoản có sẵn: chặn chiếm trước tài khoản qua email chưa xác thực.
// Chạy trên MySQL thật (DB techshop_google_link_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let authService;

const ATTACKER_PASSWORD = "Attacker123";

const googleProfile = (email, providerUserId) => ({
  provider: "GOOGLE",
  providerUserId,
  email,
  fullName: "Nguyen Van Victim",
  avatarUrl: null,
});

before(async () => {
  ({ app, db } = await startTestApi("google_link"));
  authService = require("../../src/services/authService");
});

after(async () => {
  await db.sequelize.close();
});

test("Google gắn vào tài khoản CHƯA xác thực thì xoá mật khẩu cũ và thu hồi mọi phiên", async () => {
  const email = "victim@example.com";

  // Kẻ tấn công đăng ký trước bằng email của nạn nhân, chưa xác thực vẫn đăng nhập được.
  await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: ATTACKER_PASSWORD, fullName: "Attacker" })
    .expect(201);
  const attackerLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: ATTACKER_PASSWORD })
    .expect(200);
  const attackerToken = attackerLogin.body.data.accessToken;

  // Nạn nhân đăng nhập bằng Google với chính email đó.
  const result = await authService.loginWithGoogle(googleProfile(email, "google-victim-1"), {});
  assert.ok(result.accessToken);

  const user = await db.User.findOne({ where: { email } });
  assert.ok(user.emailVerifiedAt);

  const providers = await db.AuthProvider.findAll({ where: { userId: user.id } });
  assert.deepEqual(providers.map((provider) => provider.provider), ["GOOGLE"]);

  // Mật khẩu kẻ tấn công đặt không còn dùng được.
  await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: ATTACKER_PASSWORD })
    .expect(401);

  // Phiên kẻ tấn công đang giữ bị thu hồi ngay.
  await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${attackerToken}`)
    .expect(401);

  // Phiên mới của nạn nhân vẫn dùng được.
  await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${result.accessToken}`)
    .expect(200);
});

test("Google gắn vào tài khoản ĐÃ xác thực thì giữ nguyên mật khẩu và phiên đang có", async () => {
  const email = "owner@example.com";
  const password = "Owner1234";
  const userService = require("../../src/services/userService");

  await userService.provisionUser({ email, password, fullName: "Owner", emailVerifiedAt: new Date() });
  const login = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);

  await authService.loginWithGoogle(googleProfile(email, "google-owner-1"), {});

  await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
  await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`)
    .expect(200);

  const user = await db.User.findOne({ where: { email } });
  const providers = await db.AuthProvider.findAll({ where: { userId: user.id } });
  assert.deepEqual(providers.map((provider) => provider.provider).sort(), ["GOOGLE", "LOCAL"]);
});
