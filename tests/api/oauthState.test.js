// Test chống login CSRF ở Google OAuth: callback phải mang đúng `state` đã phát kèm cookie.
// Không gọi tới Google thật: chỉ kiểm chặng phát state và chặng chặn callback giả.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Bật route Google kể cả khi máy chạy test không cấu hình OAuth thật.
process.env.GOOGLE_CLIENT_ID ||= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-client-secret";
process.env.GOOGLE_REDIRECT_URI ||= "http://localhost:3000/api/v1/auth/google/callback";

const { startTestApi } = require("./setup");
const { verifyOAuthState, OAUTH_STATE_COOKIE_NAME } = require("../../src/middlewares/oauthState");

let app;
let db;

const stateCookieOf = (res) =>
  (res.headers["set-cookie"] || []).find((cookie) => cookie.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));

before(async () => {
  ({ app, db } = await startTestApi("oauth_state"));
});

after(async () => {
  await db.sequelize.close();
});

test("GET /auth/google gửi state sang Google và đặt cùng giá trị vào cookie HttpOnly", async () => {
  const res = await request(app).get("/api/v1/auth/google").expect(302);

  const location = new URL(res.headers.location);
  const state = location.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{64}$/);

  const cookie = stateCookieOf(res);
  assert.ok(cookie, "thiếu cookie oauthState");
  assert.ok(cookie.startsWith(`${OAUTH_STATE_COOKIE_NAME}=${state};`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test("mỗi lần bắt đầu đăng nhập Google có một state khác nhau", async () => {
  const first = await request(app).get("/api/v1/auth/google").expect(302);
  const second = await request(app).get("/api/v1/auth/google").expect(302);

  assert.notEqual(
    new URL(first.headers.location).searchParams.get("state"),
    new URL(second.headers.location).searchParams.get("state"),
  );
});

test("callback không có cookie state bị đưa về trang đăng nhập báo lỗi", async () => {
  const res = await request(app)
    .get("/api/v1/auth/google/callback?code=attacker-code&state=abc")
    .expect(302);

  assert.match(res.headers.location, /\/login\?oauth=error$/);
  assert.equal((res.headers["set-cookie"] || []).some((c) => c.startsWith("refreshToken=")), false);
});

test("callback có state lệch với cookie bị chặn", async () => {
  const res = await request(app)
    .get("/api/v1/auth/google/callback?code=attacker-code&state=" + "b".repeat(64))
    .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${"a".repeat(64)}`)
    .expect(302);

  assert.match(res.headers.location, /\/login\?oauth=error$/);
});

test("state khớp cookie thì cho đi tiếp và xoá cookie, không dùng lại được", () => {
  const state = "c".repeat(64);
  const cleared = [];
  let passed = false;

  verifyOAuthState(
    { headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${state}` }, query: { state } },
    {
      clearCookie: (name) => cleared.push(name),
      redirect: () => assert.fail("không được chuyển hướng khi state khớp"),
    },
    () => {
      passed = true;
    },
  );

  assert.equal(passed, true);
  assert.deepEqual(cleared, [OAUTH_STATE_COOKIE_NAME]);
});
