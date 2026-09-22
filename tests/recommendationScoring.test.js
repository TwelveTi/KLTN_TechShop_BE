// Test phần chấm điểm và ghép của recommendationService.
// Toàn bộ các hàm dưới đây là hàm đồng bộ nhận object thuần, không chạm database.
const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../src/services/recommendationService");
const { HYBRID_WEIGHTS, PERSONAL_KEYS, POPULARITY_BLEND } = require("../src/services/recommendationService");

const product = (id, overrides = {}) => ({
  id,
  categoryId: "cat-1",
  brandId: "brand-1",
  basePrice: 10000000,
  salePrice: 0,
  name: "Sản phẩm",
  tagIds: [],
  ...overrides,
});

const sum = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);

test.describe("normalise", () => {
  test("chia cho giá trị lớn nhất trong lượt chạy, không phải hằng số cố định", () => {
    assert.deepEqual(service.normalise({ a: 2, b: 1 }), { a: 1, b: 0.5 });
  });

  test("không có điểm dương nào thì trả về rỗng thay vì chia cho 0", () => {
    assert.deepEqual(service.normalise({}), {});
    assert.deepEqual(service.normalise({ a: 0, b: 0 }), {});
    assert.deepEqual(service.normalise({ a: -3 }), {});
  });
});

test.describe("scoreUserPreference", () => {
  test("không có hồ sơ sở thích thì không chấm gì", () => {
    assert.deepEqual(service.scoreUserPreference([product("p1")], null), {});
  });

  test("giảm dần theo thứ hạng: danh mục ưa thích nhất ăn điểm gấp đôi hạng hai", () => {
    const profile = {
      preferredCategories: [{ id: "cat-top" }, { id: "cat-second" }],
      preferredBrands: [],
      minPrice: null,
      maxPrice: null,
    };
    const scores = service.scoreUserPreference(
      [product("p1", { categoryId: "cat-top" }), product("p2", { categoryId: "cat-second" })],
      profile,
    );

    // 0.45/1 so với 0.45/2, sau chuẩn hoá thành 1 và 0.5.
    assert.equal(scores.p1, 1);
    assert.equal(scores.p2, 0.5);
  });

  test("danh mục nặng hơn thương hiệu — 0.45 so với 0.35", () => {
    const profile = {
      preferredCategories: [{ id: "cat-x" }],
      preferredBrands: [{ id: "brand-x" }],
      minPrice: null,
      maxPrice: null,
    };
    const scores = service.scoreUserPreference(
      [
        product("byCategory", { categoryId: "cat-x", brandId: "brand-khac" }),
        product("byBrand", { categoryId: "cat-khac", brandId: "brand-x" }),
      ],
      profile,
    );
    assert.ok(scores.byCategory > scores.byBrand);
  });

  test("ngân sách là ranh giới mềm: ngoài khoảng vẫn được một phần điểm", () => {
    const profile = {
      preferredCategories: [],
      preferredBrands: [],
      minPrice: 10000000,
      maxPrice: 20000000,
    };
    const scores = service.scoreUserPreference(
      [
        product("trong", { basePrice: 15000000 }),
        product("hoiCao", { basePrice: 22000000 }),
        product("xaHan", { basePrice: 90000000 }),
      ],
      profile,
    );

    assert.equal(scores.trong, 1, "nằm trong ngân sách phải được điểm cao nhất");
    assert.ok(scores.hoiCao > 0, "vượt ngân sách một chút vẫn còn điểm");
    assert.ok(scores.hoiCao < scores.trong);
    assert.ok(!scores.xaHan, "vượt quá xa thì không còn điểm");
  });
});

test.describe("scorePopularity", () => {
  test("log1p nén đuôi dài: một sản phẩm bán chạy đột biến không dìm hết phần còn lại", () => {
    const scores = service.scorePopularity([
      product("khung", { soldCount: 10000 }),
      product("thuong", { soldCount: 100 }),
    ]);

    // Nếu chấm tuyến tính thì tỉ lệ chỉ là 0.01.
    assert.ok(scores.thuong > 0.4, `bị nén quá tay, nhận được ${scores.thuong}`);
    assert.ok(scores.thuong < 1);
  });

  test("điểm đánh giá được cân theo lượng bằng chứng đỡ lưng nó", () => {
    const scores = service.scorePopularity([
      product("itDanhGia", { soldCount: 10, averageRating: 5, reviewCount: 2 }),
      product("nhieuDanhGia", { soldCount: 10, averageRating: 4.5, reviewCount: 200 }),
    ]);

    // 5 sao từ 2 lượt không được phép thắng 4.5 sao từ 200 lượt.
    assert.ok(scores.nhieuDanhGia > scores.itDanhGia);
  });

  test("sản phẩm không có tín hiệu nào thì không xuất hiện trong kết quả", () => {
    const scores = service.scorePopularity([product("trong", { soldCount: 0, viewCount: 0 })]);
    assert.deepEqual(scores, {});
  });
});

test.describe("resolveWeights", () => {
  test("không có tín hiệu cá nhân nào thì popularity chiếm toàn bộ", () => {
    assert.deepEqual(service.resolveWeights({}), { popularity: 1 });
    assert.deepEqual(service.resolveWeights({ userPreference: { p1: 0 } }), { popularity: 1 });
  });

  test("có tín hiệu cá nhân thì popularity bị loại hẳn khỏi tổng", () => {
    // Đây là hành vi hybrid-v2: popularity là phương án dự phòng, không phải số hạng.
    assert.equal(POPULARITY_BLEND.weight, 0, "test này giả định cấu hình hybrid-v2");

    const weights = service.resolveWeights({ userPreference: { p1: 0.9 } });
    assert.ok(!("popularity" in weights));
  });

  test("chỉ chia phần cho thành phần thực sự có tín hiệu, rồi chuẩn hoá lại về tổng 1", () => {
    const weights = service.resolveWeights({
      userPreference: { p1: 0.9 },
      searchHistory: { p1: 0.5 },
      productSimilarity: { p1: 0.3 },
    });

    assert.ok(Math.abs(sum(weights) - 1) < 1e-9, "trọng số phải cộng lại bằng 1");

    // Khách có tìm kiếm mà chưa mua gì: 0.25/(0.35+0.25+0.10) ≈ 0.357, không phải 0.25.
    assert.ok(Math.abs(weights.searchHistory - 0.25 / 0.7) < 1e-9);
    assert.ok(!("purchaseHistory" in weights), "thành phần không có tín hiệu thì không được chia phần");
  });

  test("mọi thành phần cá nhân đều có tín hiệu thì tỉ lệ giữ nguyên như bảng gốc", () => {
    const components = Object.fromEntries(PERSONAL_KEYS.map((key) => [key, { p1: 0.5 }]));
    const weights = service.resolveWeights(components);
    const total = PERSONAL_KEYS.reduce((s, key) => s + HYBRID_WEIGHTS[key], 0);

    PERSONAL_KEYS.forEach((key) => {
      assert.ok(Math.abs(weights[key] - HYBRID_WEIGHTS[key] / total) < 1e-9, key);
    });
  });
});

test.describe("combine", () => {
  const components = {
    userPreference: { p1: 1, p2: 0.2 },
    popularity: { p1: 0.1, p2: 1 },
  };

  test("loại sản phẩm nằm trong excludeIds", () => {
    const ranked = service.combine([product("p1"), product("p2")], components, {
      excludeIds: new Set(["p1"]),
    });
    assert.deepEqual(ranked.map((r) => r.productId), ["p2"]);
  });

  test("sản phẩm không có điểm nào thì không lọt vào danh sách", () => {
    const ranked = service.combine([product("p1"), product("khongDiem")], components);
    assert.ok(!ranked.some((r) => r.productId === "khongDiem"));
  });

  test("gán lý do theo thành phần đóng góp nhiều nhất, không tô vẽ", () => {
    const ranked = service.combine([product("p1"), product("p2")], components, {
      weights: { userPreference: 0.5, popularity: 0.5 },
    });

    const byId = Object.fromEntries(ranked.map((r) => [r.productId, r]));
    assert.equal(byId.p1.reasonCode, "MATCHES_YOUR_TASTE");
    // p2 chỉ nổi nhờ phổ biến, phải được gọi đúng tên là POPULAR_NOW.
    assert.equal(byId.p2.reasonCode, "POPULAR_NOW");
  });

  test("điểm bằng nhau thì xếp theo productId, để hai lần chạy cho cùng thứ tự", () => {
    const tied = { userPreference: { zebra: 0.5, alpha: 0.5 } };
    const ranked = service.combine([product("zebra"), product("alpha")], tied);
    assert.deepEqual(ranked.map((r) => r.productId), ["alpha", "zebra"]);
  });

  test("mỗi kết quả mang theo phiên bản thuật toán, để số đo trước và sau còn so được", () => {
    const [top] = service.combine([product("p1")], components);
    assert.equal(top.reasonMetadata.algorithmVersion, "hybrid-v2");
  });
});

test.describe("scoreSearchHistory", () => {
  test("bỏ dấu cả hai phía: từ khoá không dấu vẫn khớp tên sản phẩm có dấu", () => {
    const scores = service.scoreSearchHistory(
      [product("dongho", { name: "Đồng hồ thông minh Galaxy" }), product("chuot", { name: "Chuột không dây" })],
      [{ keyword: "dong ho thong minh" }],
    );

    assert.equal(scores.dongho, 1);
    assert.ok(!scores.chuot);
  });

  test("từ khoá mới hơn nặng hơn từ khoá cũ", () => {
    const scores = service.scoreSearchHistory(
      [product("moi", { name: "Laptop Gaming" }), product("cu", { name: "Bàn phím cơ" })],
      [{ keyword: "laptop gaming" }, { keyword: "ban phim co" }],
    );

    assert.ok(scores.moi > scores.cu, "từ khoá đầu danh sách là mới nhất nên phải nặng hơn");
  });

  test("khớp đúng tên sản phẩm thắng khớp qua tên hãng", () => {
    const scores = service.scoreSearchHistory(
      [product("tenSP", { name: "Asus ROG Strix" }), product("tenHang", { name: "Laptop phổ thông", brandId: "b-asus" })],
      [{ keyword: "asus" }],
      { brandNames: { "b-asus": "Asus" } },
    );

    assert.ok(scores.tenSP > scores.tenHang);
  });

  test("không có lịch sử tìm kiếm thì không chấm gì", () => {
    assert.deepEqual(service.scoreSearchHistory([product("p1")], []), {});
    assert.deepEqual(service.scoreSearchHistory([product("p1")], null), {});
  });
});
