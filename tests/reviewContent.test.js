// Review seed phải khớp loại hàng và không trùng nhau trong cùng sản phẩm:
// AI so sánh đọc đúng những bài này để viết ưu nhược điểm.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const families = require("../src/seed/data/catalog");
const { buildFamilyReviews } = require("../src/seed/data/buildFamilyReviews");

const reviews = buildFamilyReviews(families);
const familyOf = new Map(families.map((family) => [family.key, family]));
const isMouse = (f) => /chuột/i.test(f.name) && !/bàn phím/i.test(f.name);
const isWiredHeadphone = (f) => /^Tai nghe/i.test(f.name) && /không dùng pin/i.test(String(f.specs.batteryLife?.[1] || ""));

test("mỗi sản phẩm không có hai review trùng tiêu đề", () => {
  const titlesByProduct = new Map();
  reviews.forEach((r) => titlesByProduct.set(r.productKey, [...(titlesByProduct.get(r.productKey) || []), r.title]));
  const duplicated = [...titlesByProduct].filter(([, titles]) => new Set(titles).size !== titles.length).map(([key]) => key);
  assert.deepEqual(duplicated, []);
});

test("câu chốt không thiếu thông số", () => {
  assert.deepEqual(reviews.filter((r) => /undefined|null/.test(r.content)).map((r) => r.productKey), []);
});

test("chuột văn phòng không được khen chơi game, chuột không nhận câu của bàn phím", () => {
  const wrong = reviews.filter((r) => {
    const f = familyOf.get(r.productKey);
    if (!isMouse(f)) return false;
    const gamingPraise = !/gaming/i.test(f.name) && r.rating >= 4 && /game/i.test(r.title + r.content);
    return gamingPraise || /gõ|bàn phím|chân gạt/i.test(r.content);
  });
  assert.deepEqual(wrong.map((r) => `${r.productKey}: ${r.title}`), []);
});

test("tai nghe có dây không nhận câu về micro, ứng dụng hay đàm thoại", () => {
  const wrong = reviews.filter((r) => isWiredHeadphone(familyOf.get(r.productKey)) && /micro|ứng dụng|đàm thoại/i.test(r.content));
  assert.deepEqual(wrong.map((r) => `${r.productKey}: ${r.title}`), []);
});
