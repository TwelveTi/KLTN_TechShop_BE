// Content-based similarity between two products.
//
// "Content-based" means the score comes only from what the products ARE — their
// category, brand, tags, price and specifications — never from who bought them.
// That is what lets it recommend a product nobody has interacted with yet, which
// pure collaborative filtering cannot do (the cold-start problem).
//
// Kept pure and separate from the service so each component can be tested on its
// own, and so the formula is readable as a formula.

// Component weights. They sum to 1, so the result is always in [0, 1].
//
// Category dominates because a mouse and a laptop are not substitutes however
// close their price. Price is deliberately weaker than brand: shoppers cross a
// price band more readily than they cross a brand loyalty.
const WEIGHTS = {
  category: 0.3,
  brand: 0.2,
  tags: 0.2,
  price: 0.15,
  specs: 0.15,
};

const priceOf = (product) => {
  const sale = Number(product.salePrice);
  const base = Number(product.basePrice);
  return sale > 0 && sale < base ? sale : base;
};

/**
 * Jaccard index: shared / union. Chosen over raw overlap count so a product
 * carrying twenty tags does not look similar to everything.
 */
const jaccard = (a = [], b = []) => {
  const left = new Set(a);
  const right = new Set(b);

  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let shared = 0;
  left.forEach((value) => {
    if (right.has(value)) {
      shared += 1;
    }
  });

  const union = left.size + right.size - shared;

  return union === 0 ? 0 : shared / union;
};

/**
 * Relative closeness in price: identical price scores 1, one product at twice
 * the other scores 0.5, an order of magnitude apart scores ~0.1.
 *
 * Relative rather than absolute on purpose — a 500k gap means something very
 * different on a 1M mouse than on a 50M laptop.
 */
const priceProximity = (a, b) => {
  const pa = priceOf(a);
  const pb = priceOf(b);

  if (pa <= 0 || pb <= 0) {
    return 0;
  }

  return Math.min(pa, pb) / Math.max(pa, pb);
};

/**
 * Fraction of shared specification fields where the two products agree.
 *
 * Only fields BOTH products declare are considered: penalising a product for a
 * spec the other one simply does not list would measure catalogue completeness,
 * not similarity.
 *
 * **Spec số được so theo tỉ lệ, không theo phép bằng nhau.** Trước thay đổi này
 * cả hàm chỉ có một nhánh `String(a) === String(b)`, nên hai con số gần nhau bị
 * coi là khác hẳn:
 *
 *   screen   6.7"  vs 6.8"      (lệch  1%) -> 0 điểm
 *   battery  5000  vs 4880 mAh  (lệch  2%) -> 0 điểm
 *   caseSize 47mm  vs 49mm      (lệch  4%) -> 0 điểm
 *   screen   13.6" vs 14.2"     (lệch  4%) -> 0 điểm
 *
 * Đo trên 29 cặp sản phẩm cùng danh mục: trong 56 cặp giá trị spec số, 33.9%
 * lệch dưới 20% mà vẫn nhận 0 điểm, chỉ 23.2% được điểm. Kết quả là `specs` chỉ
 * đóng góp trung bình 0.080/1.0 — yếu nhất trong năm phần, trong khi `price`
 * (vốn đã dùng tỉ lệ) đạt 0.550.
 *
 * `findProductFacets` đã đưa `value_number` về đúng kiểu số từ lượt trả nợ
 * 5.3.1; phần còn thiếu là **so chúng như số**. Dùng đúng công thức của
 * `priceProximity` để hai trục số trong cùng một điểm similarity hành xử giống
 * nhau, chứ không phải mỗi trục một luật.
 *
 * Spec chữ và spec boolean (đến đây dưới dạng `value_text`) vẫn so bằng nhau
 * chính xác: "Windows 11 Home" và "macOS Sonoma" không có khái niệm gần nhau.
 */
const specAgreement = (specsA = {}, specsB = {}) => {
  const keys = Object.keys(specsA).filter((key) => specsB[key] !== undefined);

  if (keys.length === 0) {
    return 0;
  }

  const total = keys.reduce((sum, key) => {
    const a = specsA[key];
    const b = specsB[key];

    if (typeof a === "number" && typeof b === "number") {
      if (a === b) {
        return sum + 1;
      }

      const low = Math.min(a, b);
      const high = Math.max(a, b);

      // Giá trị 0 hoặc âm không mang tín hiệu gần/xa nào có nghĩa cho một thông
      // số kỹ thuật, nên không cộng điểm thay vì trả ra tỉ lệ vô nghĩa.
      return high > 0 && low >= 0 ? sum + low / high : sum;
    }

    return sum + (String(a) === String(b) ? 1 : 0);
  }, 0);

  return total / keys.length;
};

/**
 * @param {Object} a product-like: { categoryId, brandId, basePrice, salePrice, tagIds, specs }
 * @param {Object} b same shape
 * @returns {{ score: number, parts: Object }} score in [0, 1] plus the breakdown
 *
 * The breakdown is returned as well as the total because the thesis needs to
 * explain WHY two products were judged similar, and because a component that
 * silently contributes nothing is easier to spot in the parts than in the sum.
 */
const computeContentSimilarity = (a, b) => {
  const parts = {
    category: a.categoryId && b.categoryId && a.categoryId === b.categoryId ? 1 : 0,
    brand: a.brandId && b.brandId && a.brandId === b.brandId ? 1 : 0,
    tags: jaccard(a.tagIds, b.tagIds),
    price: priceProximity(a, b),
    specs: specAgreement(a.specs, b.specs),
  };

  const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + parts[key] * weight, 0);

  return { score: Math.round(score * 10000) / 10000, parts };
};

module.exports = {
  WEIGHTS,
  jaccard,
  priceProximity,
  specAgreement,
  priceOf,
  computeContentSimilarity,
};
