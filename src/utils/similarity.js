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
 */
const specAgreement = (specsA = {}, specsB = {}) => {
  const keys = Object.keys(specsA).filter((key) => specsB[key] !== undefined);

  if (keys.length === 0) {
    return 0;
  }

  const agreed = keys.filter((key) => String(specsA[key]) === String(specsB[key])).length;

  return agreed / keys.length;
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
