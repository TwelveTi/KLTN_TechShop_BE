// Test Advisor tra đúng sản phẩm khách gọi tên: dựng lại ca 23/10, hãng có 12 máy, máy được hỏi
// bán chậm nhất nên rơi khỏi top 8 của search_products. Không gọi Gemini, chỉ chạy tool như vòng lặp thật.
// Chạy trên MySQL thật (DB techshop_advisor_named_test).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestApi } = require("./setup");

let db;
let aiService;
let target;

const TARGET_NAME = "Laptop ASUS Vivobook 15 X1504VA (Core i5-1335U / 16GB / 512GB)";

before(async () => {
  ({ db } = await startTestApi("advisor_named"));
  aiService = require("../../src/services/aiService");

  const parent = await db.Category.create({ name: "Laptops & Máy Tính", slug: "laptop-may-tinh" });
  const office = await db.Category.create({ name: "Laptop Văn Phòng", slug: "laptop-van-phong", parentId: parent.id });
  const brand = await db.Brand.create({ name: "ASUS", slug: "asus" });

  for (let i = 1; i <= 11; i += 1) {
    await db.Product.create({
      categoryId: office.id,
      brandId: brand.id,
      name: `Laptop ASUS Zenbook Model ${i}`,
      slug: `asus-zenbook-${i}`,
      basePrice: 20000000 + i * 1000000,
      stockQuantity: 10,
      soldCount: 100 + i,
      status: "ACTIVE",
    });
  }
  target = await db.Product.create({
    categoryId: office.id,
    brandId: brand.id,
    name: TARGET_NAME,
    slug: "asus-vivobook-15-x1504va",
    basePrice: 14990000,
    salePrice: 12990000,
    stockQuantity: 52,
    soldCount: 3,
    status: "ACTIVE",
  });
});

after(async () => {
  await db.sequelize.close();
});

test("Advisor được khai tool tra theo tên, và prompt bắt dùng nó khi khách gọi tên sản phẩm", () => {
  const advisor = require("../../src/services/ai/prompts/advisor");

  assert.ok(advisor.toolNames.includes("find_products_by_name"));
  const instruction = advisor.buildSystemInstruction({ categories: [], brands: [] }, "vi");
  assert.match(instruction, /find_products_by_name/);
});

test("lọc theo hãng như model đã làm thì máy được hỏi rơi khỏi top 8: đây là lỗi cũ", async () => {
  const result = await aiService.runTool({
    name: "search_products",
    args: { brandNames: ["ASUS"], categorySlug: "laptop-may-tinh", sortBy: "relevance", limit: 8 },
  });

  assert.equal(result.products.length, 8);
  assert.equal(result.products.some((product) => product.id === target.id), false);
});

test("tra theo tên tìm ra đúng máy kèm giá thật, và gắn được thẻ sản phẩm", async () => {
  const result = await aiService.runTool({
    name: "find_products_by_name",
    args: { names: ["ASUS Vivobook 15 X1504VA"] },
  });

  assert.equal(result.payload.count, 1);
  const [found] = result.payload.products;
  assert.equal(found.name, TARGET_NAME);
  assert.equal(JSON.stringify(found).includes("12990000"), true, "model phải đọc được giá bán thật");
  assert.deepEqual(result.products.map((product) => product.id), [target.id]);
});

test("tên không có trong kho được báo trong notFound để model nói thẳng là không bán", async () => {
  const result = await aiService.runTool({
    name: "find_products_by_name",
    args: { names: ["iPhone 99 Pro Max"] },
  });

  assert.equal(result.payload.count, 0);
  assert.deepEqual(result.payload.notFound, ["iPhone 99 Pro Max"]);
});
