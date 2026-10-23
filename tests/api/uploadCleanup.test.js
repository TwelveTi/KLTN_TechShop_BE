// Test dọn ảnh sau khi tạo sản phẩm thất bại: chỉ admin đã xác thực mới kích hoạt được,
// và chỉ xoá ảnh trong thư mục sản phẩm. Cloudinary được giả lập, không xoá ảnh thật.
// Chạy trên MySQL thật (DB techshop_upload_cleanup_test), gọi app qua supertest.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi } = require("./setup");

let app;
let db;
let uploadService;
let deleted;
let adminToken;
let customerToken;

const VICTIM_AVATAR = "techshop/avatars/victim-avatar";
const VICTIM_PRODUCT_IMAGE = "techshop/products/existing-product-image";

const bodyWith = (...publicIds) => ({
  name: "x",
  images: publicIds.map((publicId) => ({ imageUrl: "https://res.cloudinary.com/demo/x.webp", publicId })),
});

async function loginAs(email, role) {
  const userService = require("../../src/services/userService");
  await userService.provisionUser({ email, password: "Secret123", fullName: "U", role, emailVerifiedAt: new Date() });
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: "Secret123" });
  return res.body.data.accessToken;
}

before(async () => {
  ({ app, db } = await startTestApi("upload_cleanup"));
  uploadService = require("../../src/services/uploadService");
  uploadService.deleteOne = async (publicId) => {
    deleted.push(publicId);
    return { result: "ok" };
  };
  adminToken = await loginAs("admin-cleanup@example.com", "ADMIN");
  customerToken = await loginAs("customer-cleanup@example.com", "CUSTOMER");
});

beforeEach(() => {
  deleted = [];
});

after(async () => {
  await db.sequelize.close();
});

test("người lạ không token gửi publicId thì KHÔNG ảnh nào bị xoá", async () => {
  const res = await request(app).post("/api/v1/admin/products").send(bodyWith(VICTIM_AVATAR, VICTIM_PRODUCT_IMAGE));

  assert.equal(res.status, 401);
  assert.deepEqual(deleted, []);
});

test("khách hàng thường bị 403 và cũng không xoá được ảnh nào", async () => {
  const res = await request(app)
    .post("/api/v1/admin/products")
    .set("Authorization", `Bearer ${customerToken}`)
    .send(bodyWith(VICTIM_PRODUCT_IMAGE));

  assert.equal(res.status, 403);
  assert.deepEqual(deleted, []);
});

test("admin tạo sản phẩm hỏng thì chỉ ảnh trong thư mục sản phẩm được dọn", async () => {
  const res = await request(app)
    .post("/api/v1/admin/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(bodyWith("techshop/products/just-uploaded", VICTIM_AVATAR));

  assert.equal(res.status, 400);
  assert.deepEqual(deleted, ["techshop/products/just-uploaded"]);
});

test("admin không xoá được ảnh ngoài thư mục sản phẩm qua endpoint xoá ảnh", async () => {
  const res = await request(app)
    .delete("/api/v1/admin/uploads/images")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ publicId: VICTIM_AVATAR });

  assert.equal(res.status, 400);
  assert.deepEqual(deleted, []);
});
