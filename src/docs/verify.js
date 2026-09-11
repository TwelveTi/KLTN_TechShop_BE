require("dotenv").config();

// Đối chiếu spec OpenAPI với bảng route THẬT của Express.
//
// Một trang Swagger viết tay thì trôi khỏi code mà không báo gì: thêm endpoint
// quên viết docs, hoặc đổi đường dẫn mà docs vẫn giữ cái cũ. Script này biến cả
// hai thành lỗi đọc được. Chạy: `npm run docs:verify`.
const express = require("express");
const route = require("../routes");
const { buildSpec } = require("./index");

const METHODS = ["get", "post", "put", "patch", "delete"];
const API_PREFIX = "/api/v1";

// `/auth/sessions/:id` -> `/auth/sessions/{id}` để so được với OpenAPI.
const toOpenApiPath = (expressPath) => expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

// Chính trang docs không phải bề mặt API nên không tự mô tả mình.
const SELF = ["/api/docs.json"];

function collectExpressRoutes() {
  const app = express();
  route(app);

  const found = new Set();

  // Route khai thẳng trên `app` mang đường dẫn tuyệt đối; route nằm trong một
  // router con thì tương đối với chỗ nó được mount (`API_PREFIX`).
  const walk = (stack, prefix) => {
    stack.forEach((layer) => {
      if (layer.route) {
        const full = toOpenApiPath(prefix + layer.route.path);
        if (SELF.includes(full)) {
          return;
        }
        Object.keys(layer.route.methods)
          .filter((method) => METHODS.includes(method))
          .forEach((method) => found.add(`${method.toUpperCase()} ${full}`));
        return;
      }

      if (layer.name === "router" && layer.handle?.stack) {
        walk(layer.handle.stack, API_PREFIX);
      }
    });
  };

  walk(app.router.stack, "");

  return found;
}

function collectSpecRoutes(spec) {
  const found = new Set();

  Object.entries(spec.paths).forEach(([path, operations]) => {
    Object.keys(operations)
      .filter((method) => METHODS.includes(method))
      .forEach((method) => found.add(`${method.toUpperCase()} ${API_PREFIX}${path}`));
  });

  return found;
}

const spec = buildSpec();
const inCode = collectExpressRoutes();
const inDocs = collectSpecRoutes(spec);

const missing = [...inCode].filter((entry) => !inDocs.has(entry)).sort();
const extra = [...inDocs].filter((entry) => !inCode.has(entry)).sort();

console.log(`Route trong code : ${inCode.size}`);
console.log(`Route trong docs : ${inDocs.size}`);

if (missing.length > 0) {
  console.log(`\nTHIẾU trong docs (${missing.length}):`);
  missing.forEach((entry) => console.log(`  ${entry}`));
}

if (extra.length > 0) {
  console.log(`\nTHỪA trong docs — không còn trong code (${extra.length}):`);
  extra.forEach((entry) => console.log(`  ${entry}`));
}

if (missing.length === 0 && extra.length === 0) {
  console.log("\nKhớp hoàn toàn.");
}

process.exit(missing.length + extra.length === 0 ? 0 : 1);
