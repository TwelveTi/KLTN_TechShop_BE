// Test bật/tắt Swagger: production mặc định tắt, chỉ mở khi đặt API_DOCS_ENABLED=true.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { docsEnabled, mountDocs } = require("../src/docs");

test("production mặc định tắt docs", () => {
  assert.equal(docsEnabled({ NODE_ENV: "production" }), false);
});

test("máy dev và môi trường test mặc định bật docs", () => {
  assert.equal(docsEnabled({ NODE_ENV: "development" }), true);
  assert.equal(docsEnabled({ NODE_ENV: "test" }), true);
  assert.equal(docsEnabled({}), true);
});

test("API_DOCS_ENABLED ghi đè mặc định ở cả hai chiều", () => {
  assert.equal(docsEnabled({ NODE_ENV: "production", API_DOCS_ENABLED: "true" }), true);
  assert.equal(docsEnabled({ NODE_ENV: "development", API_DOCS_ENABLED: "false" }), false);
});

test("khi tắt thì /api/docs và /api/docs.json trả 404", async (t) => {
  t.after(() => {
    process.env.NODE_ENV = previous.NODE_ENV;
    process.env.API_DOCS_ENABLED = previous.API_DOCS_ENABLED ?? "";
  });
  const previous = { NODE_ENV: process.env.NODE_ENV, API_DOCS_ENABLED: process.env.API_DOCS_ENABLED };
  process.env.NODE_ENV = "production";
  process.env.API_DOCS_ENABLED = "";

  const app = express();
  assert.equal(mountDocs(app), null);

  await request(app).get("/api/docs.json").expect(404);
  await request(app).get("/api/docs/").expect(404);
});

test("khi bật thì /api/docs.json trả spec", async (t) => {
  t.after(() => {
    process.env.API_DOCS_ENABLED = previous ?? "";
  });
  const previous = process.env.API_DOCS_ENABLED;
  process.env.API_DOCS_ENABLED = "true";

  const app = express();
  mountDocs(app);

  const res = await request(app).get("/api/docs.json").expect(200);
  assert.ok(res.body.paths["/auth/login"]);
});
