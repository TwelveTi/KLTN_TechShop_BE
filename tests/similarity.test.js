// Test công thức content-similarity ở src/utils/similarity.js.
// Mỗi test khoá lại một quyết định thiết kế đã ghi trong README 6.4.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WEIGHTS,
  jaccard,
  priceProximity,
  specAgreement,
  priceOf,
  computeContentSimilarity,
} = require("../src/utils/similarity");

// Sản phẩm mẫu tối thiểu; từng test chỉ ghi đè trường nó quan tâm.
const product = (overrides = {}) => ({
  categoryId: "cat-laptop",
  brandId: "brand-asus",
  basePrice: 20000000,
  salePrice: 0,
  tagIds: [],
  specs: {},
  ...overrides,
});

test("WEIGHTS cộng lại đúng bằng 1 nên điểm luôn nằm trong [0, 1]", () => {
  const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);
  assert.equal(Math.round(total * 1000) / 1000, 1);
});

test("hai sản phẩm giống hệt nhau được điểm tuyệt đối", () => {
  const a = product({ tagIds: ["gaming"], specs: { ram: 16 } });
  const { score } = computeContentSimilarity(a, { ...a });
  assert.equal(score, 1);
});

test("khác danh mục, khác hãng, lệch giá xa thì điểm thấp", () => {
  const laptop = product();
  const cable = product({
    categoryId: "cat-cable",
    brandId: "brand-anker",
    basePrice: 200000,
  });
  const { score } = computeContentSimilarity(laptop, cable);
  assert.ok(score < 0.05, `điểm phải thấp, nhận được ${score}`);
});

test("cùng danh mục ăn đứt cùng giá — danh mục 0.30 so với giá 0.15", () => {
  const base = product();
  const sameCategoryOtherPrice = product({ brandId: "brand-dell", basePrice: 60000000 });
  const otherCategorySamePrice = product({ categoryId: "cat-phone", brandId: "brand-dell" });

  const withCategory = computeContentSimilarity(base, sameCategoryOtherPrice).score;
  const withPrice = computeContentSimilarity(base, otherCategorySamePrice).score;

  assert.ok(withCategory > withPrice, `${withCategory} phải lớn hơn ${withPrice}`);
});

test("computeContentSimilarity trả về cả phần tách, để giải thích được vì sao giống", () => {
  const { parts } = computeContentSimilarity(product(), product({ brandId: "brand-dell" }));
  assert.deepEqual(Object.keys(parts).sort(), ["brand", "category", "price", "specs", "tags"]);
  assert.equal(parts.category, 1);
  assert.equal(parts.brand, 0);
});

test.describe("jaccard", () => {
  test("hai tập rỗng cho 0 chứ không phải 1", () => {
    assert.equal(jaccard([], []), 0);
  });

  test("không giao nhau thì bằng 0, trùng hoàn toàn thì bằng 1", () => {
    assert.equal(jaccard(["a"], ["b"]), 0);
    assert.equal(jaccard(["a", "b"], ["b", "a"]), 1);
  });

  test("sản phẩm mang rất nhiều tag không vì thế mà giống mọi thứ", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    // Chia cho hợp, không phải đếm số tag chung: 1 tag chung trên 20 thì vẫn thấp.
    assert.ok(jaccard(many, ["tag-0"]) < 0.06);
  });
});

test.describe("priceProximity", () => {
  test("giá bằng nhau cho 1, gấp đôi cho 0.5", () => {
    assert.equal(priceProximity(product({ basePrice: 100 }), product({ basePrice: 100 })), 1);
    assert.equal(priceProximity(product({ basePrice: 100 }), product({ basePrice: 200 })), 0.5);
  });

  test("lệch một bậc độ lớn cho khoảng 0.1", () => {
    const value = priceProximity(product({ basePrice: 100 }), product({ basePrice: 1000 }));
    assert.ok(Math.abs(value - 0.1) < 1e-9);
  });

  test("giá bằng 0 hoặc âm thì không cho điểm, thay vì chia ra số vô nghĩa", () => {
    assert.equal(priceProximity(product({ basePrice: 0 }), product({ basePrice: 100 })), 0);
    assert.equal(priceProximity(product({ basePrice: -5 }), product({ basePrice: 100 })), 0);
  });

  test("đối xứng: đổi chỗ hai sản phẩm không đổi kết quả", () => {
    const a = product({ basePrice: 3000000 });
    const b = product({ basePrice: 7000000 });
    assert.equal(priceProximity(a, b), priceProximity(b, a));
  });
});

test.describe("priceOf", () => {
  test("dùng giá khuyến mãi khi nó hợp lệ và thấp hơn giá gốc", () => {
    assert.equal(priceOf({ basePrice: 100, salePrice: 80 }), 80);
  });

  test("bỏ qua giá khuyến mãi bằng 0, âm, hoặc cao hơn giá gốc", () => {
    assert.equal(priceOf({ basePrice: 100, salePrice: 0 }), 100);
    assert.equal(priceOf({ basePrice: 100, salePrice: -1 }), 100);
    assert.equal(priceOf({ basePrice: 100, salePrice: 150 }), 100);
  });
});

test.describe("specAgreement", () => {
  test("không có trường nào chung thì bằng 0", () => {
    assert.equal(specAgreement({ ram: 16 }, { storage: 512 }), 0);
  });

  test("chỉ xét trường CẢ HAI cùng khai, không phạt vì thiếu thông số", () => {
    // ram khớp; storage chỉ một bên khai nên không được tính vào mẫu số.
    assert.equal(specAgreement({ ram: 16, storage: 512 }, { ram: 16 }), 1);
  });

  // Đây là lỗi đã sửa ở README 6.4: trước đó mọi spec so bằng String() nên
  // 6.7" và 6.8" bị chấm 0 điểm dù chỉ lệch 1%.
  test("spec dạng SỐ so theo tỉ lệ, không theo phép bằng nhau", () => {
    const almost = specAgreement({ screen: 6.7 }, { screen: 6.8 });
    assert.ok(almost > 0.98, `6.7 và 6.8 phải gần như khớp, nhận được ${almost}`);

    const battery = specAgreement({ battery: 5000 }, { battery: 4880 });
    assert.ok(battery > 0.97, `5000 và 4880 mAh phải gần khớp, nhận được ${battery}`);
  });

  test("spec dạng CHỮ vẫn so bằng nhau chính xác", () => {
    // Hai hệ điều hành không có khái niệm "gần nhau".
    assert.equal(specAgreement({ os: "Windows 11 Home" }, { os: "macOS Sonoma" }), 0);
    assert.equal(specAgreement({ os: "Windows 11 Home" }, { os: "Windows 11 Home" }), 1);
  });

  test("spec số bằng 0 hoặc âm không được cộng điểm", () => {
    assert.equal(specAgreement({ weight: 0 }, { weight: 5 }), 0);
    assert.equal(specAgreement({ offset: -3 }, { offset: 5 }), 0);
  });

  test("trung bình trên các trường chung, không phải tổng", () => {
    // Một trường khớp, một trường lệch hẳn.
    const value = specAgreement({ ram: 16, os: "Windows" }, { ram: 16, os: "macOS" });
    assert.equal(value, 0.5);
  });
});
