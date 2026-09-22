const js = require("@eslint/js");
const globals = require("globals");

// Cấu hình phẳng của ESLint 9 trở lên. Backend là CommonJS thuần, không build.
module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**", "src/seed/rag/cache/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Tham số đặt tên bắt đầu bằng _ là cố ý bỏ không dùng.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // catch rỗng được dùng có chủ đích ở vài chỗ, luôn kèm comment giải thích.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
