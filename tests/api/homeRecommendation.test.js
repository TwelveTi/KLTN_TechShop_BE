// Test API dải gợi ý trang chủ: khách mới nhận hàng bán chạy và được ghi đúng nhãn,
// xem sản phẩm xong thì dải đổi theo ngay, không phải chờ cache 15 phút hết hạn.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startTestApi, createCustomer } = require("./setup");

let app;
let db;
let laptops;
let shopper;

const home = (token) =>
  request(app).get("/api/v1/recommendations").query({ limit: 4 }).set("Authorization", `Bearer ${token}`);

before(async () => {
  ({ app, db } = await startTestApi("homerec"));

  const laptopCat = await db.Category.create({ name: "Laptop", slug: "laptop" });
  const phoneCat = await db.Category.create({ name: "Phone", slug: "phone" });
  const asus = await db.Brand.create({ name: "Asus", slug: "asus" });
  const samsung = await db.Brand.create({ name: "Samsung", slug: "samsung" });

  const make = (category, brand, name, soldCount) =>
    db.Product.create({
      categoryId: category.id,
      brandId: brand.id,
      status: "ACTIVE",
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      basePrice: 20000000,
      stockQuantity: 5,
      soldCount,
    });

  // Điện thoại bán chạy hơn, nên khách chưa có tín hiệu sẽ thấy điện thoại đứng đầu.
  for (let i = 1; i <= 4; i += 1) await make(phoneCat, samsung, `Galaxy ${i}`, 100 - i);
  laptops = [];
  for (let i = 1; i <= 4; i += 1) laptops.push(await make(laptopCat, asus, `Zenbook ${i}`, 5 - i));

  await db.ProductSimilarity.bulkCreate(
    laptops.slice(1).map((other, index) => ({
      productId: laptops[0].id,
      similarProductId: other.id,
      similarityType: "CONTENT",
      score: 0.9 - index * 0.1,
    })),
  );

  shopper = await createCustomer(app, db, "newbie@example.com");
});

after(async () => {
  await db.sequelize.close();
});

test("khách chưa có hành vi nhận hàng bán chạy, ghi là popularity-fallback chứ không phải hybrid", async () => {
  const res = await home(shopper.token);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.strategy, "popularity-fallback");
  assert.equal(res.body.data.personalised, false);
  assert.ok(res.body.data.items.every((item) => item.reasonCode === "POPULAR_NOW"));
});

test("xem một laptop xong thì dải trang chủ tính lại ngay và nghiêng về laptop", async () => {
  const cachedBefore = await home(shopper.token);
  assert.equal(cachedBefore.body.data.cached, true);

  const view = await request(app)
    .get(`/api/v1/products/${laptops[0].id}`)
    .set("Authorization", `Bearer ${shopper.token}`);
  assert.equal(view.status, 200);

  const after = await home(shopper.token);
  const laptopIds = new Set(laptops.map((laptop) => laptop.id));

  assert.equal(after.body.data.cached, false);
  assert.equal(after.body.data.strategy, "hybrid");
  assert.equal(after.body.data.personalised, true);
  assert.ok(laptopIds.has(after.body.data.items[0].product.id), "gợi ý đầu tiên phải là laptop");
});

test("hồ sơ sở thích được tính lại từ hành vi mới, không đứng yên ở lúc seed", async () => {
  const profile = await db.UserPreferenceProfile.findOne({ where: { userId: shopper.user.id }, raw: true });

  assert.ok(profile, "phải có hồ sơ sau khi xem sản phẩm");
  assert.equal(profile.preferredCategories[0].id, laptops[0].categoryId);
});
