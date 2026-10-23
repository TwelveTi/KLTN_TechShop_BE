// Test các điểm gia cố nhỏ: cookie hỏng không gây 500, refresh token cũ trong thời gian ân hạn
// không tạo được phiên mới, và ký tự đại diện của LIKE được tìm đúng nghĩa đen.
// Chạy trên MySQL thật (DB techshop_hardening_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");
const { escapeLike, likeContains } = require("../../src/utils/sqlLike");

let app;
let db;

const PASSWORD = "Secret123";

const refreshCookieOf = (res) =>
  (res.headers["set-cookie"] || []).find((cookie) => cookie.startsWith("refreshToken="));
const cookiePair = (setCookie) => setCookie.split(";")[0];

async function createAndLogin(email, extra = {}) {
  const userService = require("../../src/services/userService");
  const user = await userService.provisionUser({
    email,
    password: PASSWORD,
    fullName: email.split("@")[0],
    emailVerifiedAt: new Date(),
    ...extra,
  });
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  return { user, token: res.body.data.accessToken, cookie: cookiePair(refreshCookieOf(res)) };
}

before(async () => {
  ({ app, db } = await startTestApi("hardening"));
});

after(async () => {
  await db.sequelize.close();
});

// ---- A1: cookie hỏng ----
test("cookie mã hoá hỏng không làm refresh trả 500", async () => {
  const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", "refreshToken=%E0%A4%A");
  assert.equal(res.status, 401);
});

test("cookie hỏng bên cạnh cookie lành vẫn đọc được cookie lành", async () => {
  const { cookie } = await createAndLogin("cookie@example.com");
  const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", `broken=%E0%A4%A; ${cookie}`);
  assert.equal(res.status, 200);
});

// ---- A2: tái dùng refresh token trong thời gian ân hạn ----
test("token vừa xoay vòng chỉ đổi được access token ngắn hạn, không đẻ thêm phiên", async () => {
  const { user, cookie: oldCookie } = await createAndLogin("grace@example.com");

  // Đẩy hạn token xuống dưới 24 giờ để lần refresh kế tiếp phải xoay vòng.
  await db.RefreshToken.update(
    { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { where: { userId: user.id } },
  );
  const rotated = await request(app).post("/api/v1/auth/refresh").set("Cookie", oldCookie).expect(200);
  assert.ok(refreshCookieOf(rotated), "lần xoay vòng phải phát cookie mới");
  const sessionsAfterRotate = await db.RefreshToken.count({ where: { userId: user.id } });

  // Một request đang bay vẫn cầm cookie cũ.
  const reused = await request(app).post("/api/v1/auth/refresh").set("Cookie", oldCookie).expect(200);
  assert.ok(reused.body.data.accessToken);
  assert.equal(refreshCookieOf(reused), undefined, "không được phát cookie 7 ngày mới");
  assert.equal(await db.RefreshToken.count({ where: { userId: user.id } }), sessionsAfterRotate);

  // Access token đó dùng được ngay, nhưng chết khi hết ân hạn của phiên cũ.
  const graceToken = reused.body.data.accessToken;
  await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${graceToken}`).expect(200);

  await db.RefreshToken.update(
    { revokedAt: new Date(Date.now() - 31 * 1000) },
    { where: { userId: user.id, tokenHash: require("../../src/utils/tokenHash").hashToken(oldCookie.split("=")[1]) } },
  );
  await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${graceToken}`).expect(401);
  await request(app).post("/api/v1/auth/refresh").set("Cookie", oldCookie).expect(401);

  // Cookie mới từ lần xoay vòng vẫn dùng bình thường.
  await request(app)
    .post("/api/v1/auth/refresh")
    .set("Cookie", cookiePair(refreshCookieOf(rotated)))
    .expect(200);
});

// ---- A3: ký tự đại diện trong LIKE ----
test("escapeLike giữ %, _ và \\ theo nghĩa đen", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  assert.equal(likeContains("a%"), "%a\\%%");
});

test("tìm user bằng % hay _ không còn trả về mọi người dùng", async () => {
  const { token } = await createAndLogin("admin-search@example.com", { role: "ADMIN" });
  await createAndLogin("plain@example.com", { fullName: "Nguyen Van Thuong" });
  await createAndLogin("percent@example.com", { fullName: "Shop Giam 50% Gia" });

  const search = (q) =>
    request(app).get("/api/v1/admin/users").query({ q, limit: 100 }).set("Authorization", `Bearer ${token}`);

  const total = (await search("")).body.data.pagination.total;
  assert.ok(total >= 3);

  const percent = await search("%").expect(200);
  assert.deepEqual(percent.body.data.items.map((u) => u.email), ["percent@example.com"]);

  const underscore = await search("_").expect(200);
  assert.equal(underscore.body.data.pagination.total, 0);

  const literal = await search("50%").expect(200);
  assert.deepEqual(literal.body.data.items.map((u) => u.email), ["percent@example.com"]);
});
