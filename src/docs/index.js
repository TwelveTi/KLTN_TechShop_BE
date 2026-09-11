const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");

// Spec đứng riêng trong `src/docs/` thay vì swagger-jsdoc: nó giữ route file
// sạch, và một file YAML sai cú pháp thì hỏng ngay lúc boot chứ không âm thầm
// biến mất khỏi trang docs.
const DOCS_DIR = __dirname;
const PATHS_DIR = path.join(DOCS_DIR, "paths");

const readYaml = (file) => yaml.load(fs.readFileSync(file, "utf8"));

function buildSpec() {
  const spec = readYaml(path.join(DOCS_DIR, "openapi.base.yaml"));
  spec.paths = {};

  fs.readdirSync(PATHS_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .forEach((file) => {
      const doc = readYaml(path.join(PATHS_DIR, file)) || {};

      // Gộp theo từng path chứ không ghi đè cả object: cùng một đường dẫn có thể
      // được khai ở hai file với hai method khác nhau.
      Object.entries(doc).forEach(([route, operations]) => {
        spec.paths[route] = { ...(spec.paths[route] || {}), ...operations };
      });
    });

  return spec;
}

// Đếm để `verify-openapi.js` đối chiếu với số route thật của Express.
function countOperations(spec) {
  const METHODS = ["get", "post", "put", "patch", "delete"];

  return Object.values(spec.paths).reduce(
    (total, operations) => total + Object.keys(operations).filter((key) => METHODS.includes(key)).length,
    0,
  );
}

function mountDocs(app, { route = "/api/docs" } = {}) {
  const spec = buildSpec();

  // JSON thô để import vào Postman / sinh client.
  app.get(`${route}.json`, (req, res) => res.json(spec));

  app.use(
    route,
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "AI Tech Shop API",
      swaggerOptions: { persistAuthorization: true, docExpansion: "none", tagsSorter: "alpha" },
    }),
  );

  return spec;
}

module.exports = { buildSpec, countOperations, mountDocs };
