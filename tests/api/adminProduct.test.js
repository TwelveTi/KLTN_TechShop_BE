// Test API admin sản phẩm: lưu thông số có kiểu, ảnh không có publicId, và
// lưu lại không làm mất thông số hay xoá nhầm ảnh trên Cloudinary.
// Chạy trên MySQL thật (DB techshop_adminproduct_test), gọi app qua supertest.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let token;
let category;
let brand;
const defs = {};
const deletedPublicIds = [];

const asAdmin = (req) => req.set("Authorization", `Bearer ${token}`);
const specsOf = async (productId) => {
  const rows = await db.ProductSpecification.findAll({ where: { productId }, raw: true });
  return Object.fromEntries(
    rows.map((row) => {
      const key = Object.values(defs).find((d) => d.id === row.specificationDefinitionId).key;
      return [key, { text: row.valueText, number: row.valueNumber === null ? null : Number(row.valueNumber) }];
    }),
  );
};

before(async () => {
  ({ app, db } = await startTestApi("adminproduct"));

  // Không gọi Cloudinary thật: ghi lại publicId nào bị yêu cầu xoá.
  const uploadService = require("../../src/services/uploadService");
  uploadService.deleteOne = async (publicId) => {
    deletedPublicIds.push(publicId);
  };

  const userService = require("../../src/services/userService");
  await userService.provisionUser({
    email: "admin@example.com",
    password: "secret123",
    fullName: "Admin",
    role: "ADMIN",
    emailVerifiedAt: new Date(),
  });
  const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@example.com", password: "secret123" });
  token = login.body.data.accessToken;

  category = await db.Category.create({ name: "Laptop", slug: "laptop" });
  brand = await db.Brand.create({ name: "Asus", slug: "asus" });
  defs.cpu = await db.SpecificationDefinition.create({ categoryId: category.id, key: "cpu", name: "CPU", dataType: "STRING" });
  defs.ram = await db.SpecificationDefinition.create({ categoryId: category.id, key: "ram", name: "RAM", dataType: "NUMBER", unit: "GB" });
});

after(async () => {
  await db.sequelize.close();
});

const productBody = (overrides = {}) => ({
  name: "Asus Zenbook 14",
  categoryId: category.id,
  brandId: brand.id,
  basePrice: 25000000,
  stockQuantity: 5,
  status: "ACTIVE",
  images: [{ imageUrl: "https://example.com/zenbook.jpg", isPrimary: true }],
  ...overrides,
});

test("tạo sản phẩm kèm thông số: NUMBER giữ cả số lẫn chữ hiển thị, ảnh không cần publicId", async () => {
  const res = await asAdmin(request(app).post("/api/v1/admin/products")).send(
    productBody({
      specifications: [
        { definitionId: defs.cpu.id, name: "CPU", value: "Intel Core Ultra 7" },
        { definitionId: defs.ram.id, name: "RAM", value: 16, valueText: "16GB LPDDR5X" },
      ],
    }),
  );

  assert.equal(res.status, 201);
  assert.deepEqual(await specsOf(res.body.data.id), {
    cpu: { text: "Intel Core Ultra 7", number: null },
    ram: { text: "16GB LPDDR5X", number: 16 },
  });
});

test("thông số sai kiểu bị từ chối 400 và không tạo sản phẩm nào", async () => {
  const before = await db.Product.count();
  const res = await asAdmin(request(app).post("/api/v1/admin/products")).send(
    productBody({ name: "Bad", specifications: [{ definitionId: defs.ram.id, name: "RAM", value: "mười sáu" }] }),
  );

  assert.equal(res.status, 400);
  assert.equal(await db.Product.count(), before);
});

test("lưu lại không gửi thông số thì thông số cũ giữ nguyên", async () => {
  const created = await asAdmin(request(app).post("/api/v1/admin/products")).send(
    productBody({ name: "Keep specs", specifications: [{ definitionId: defs.ram.id, name: "RAM", value: 32 }] }),
  );
  const id = created.body.data.id;

  const res = await asAdmin(request(app).put(`/api/v1/admin/products/${id}`)).send({ basePrice: 24000000 });

  assert.equal(res.status, 200);
  assert.equal((await specsOf(id)).ram.number, 32);
});

test("lưu sản phẩm chỉ xoá trên Cloudinary ảnh đã bị bỏ, ảnh còn giữ thì để nguyên", async () => {
  const created = await asAdmin(request(app).post("/api/v1/admin/products")).send(
    productBody({
      name: "Two images",
      images: [
        { imageUrl: "https://res.cloudinary.com/demo/a.jpg", publicId: "keep-me", isPrimary: true },
        { imageUrl: "https://res.cloudinary.com/demo/b.jpg", publicId: "drop-me" },
      ],
    }),
  );
  deletedPublicIds.length = 0;

  const res = await asAdmin(request(app).put(`/api/v1/admin/products/${created.body.data.id}`)).send({
    images: [{ imageUrl: "https://res.cloudinary.com/demo/a.jpg", publicId: "keep-me", isPrimary: true }],
  });

  assert.equal(res.status, 200);
  assert.deepEqual(deletedPublicIds, ["drop-me"]);
});
