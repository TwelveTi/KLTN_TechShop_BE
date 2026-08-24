const { createRandom } = require("./random");

/**
 * Builds a synthetic shopping dataset for evaluating the recommendation system.
 *
 * WHY THIS EXISTS
 * ---------------
 * A recommender cannot be evaluated on an empty database, and one developer
 * clicking around for a few weeks does not produce a dataset worth measuring.
 *
 * The important part is not the volume — it is that every simulated shopper has
 * a KNOWN latent preference (`truth`), and their events are generated from it
 * with noise on top. That gives the evaluation chapter something real to
 * measure: does the recommender recover a taste it was never told about?
 * Random events could never answer that question.
 *
 * This module is pure: it reads a catalogue and returns a plan. Nothing here
 * touches the database, so the distributions can be tested directly.
 */

// Shopper archetypes. The funnel probabilities differ per persona because real
// shoppers differ: a decided buyer converts, a browser mostly looks.
const PERSONA_TYPES = [
  {
    key: "FOCUSED_BUYER",
    // Knows what they want: one category, one brand, a narrow budget.
    share: 0.25,
    sessions: [6, 14],
    viewsPerSession: [2, 5],
    onTargetBias: 0.85,
    cartRate: 0.35,
    purchaseRate: 0.55,
    searchRate: 0.6,
    usesBrand: true,
    narrowPrice: true,
  },
  {
    key: "CATEGORY_LOYAL",
    // Committed to a category, open about brand.
    share: 0.25,
    sessions: [5, 12],
    viewsPerSession: [3, 7],
    onTargetBias: 0.75,
    cartRate: 0.25,
    purchaseRate: 0.4,
    searchRate: 0.5,
    usesBrand: false,
    narrowPrice: false,
  },
  {
    key: "BRAND_LOYAL",
    // Buys one brand across whatever category it sells.
    share: 0.2,
    sessions: [5, 12],
    viewsPerSession: [2, 6],
    onTargetBias: 0.7,
    cartRate: 0.28,
    purchaseRate: 0.45,
    searchRate: 0.45,
    usesBrand: true,
    narrowPrice: false,
    brandAcrossCategories: true,
  },
  {
    key: "BARGAIN_HUNTER",
    // Price is the preference; category matters less.
    share: 0.15,
    sessions: [8, 18],
    viewsPerSession: [4, 9],
    onTargetBias: 0.5,
    cartRate: 0.2,
    purchaseRate: 0.3,
    searchRate: 0.7,
    usesBrand: false,
    narrowPrice: false,
    cheapestBand: true,
  },
  {
    key: "WINDOW_SHOPPER",
    // Lots of looking, almost no buying. Present on purpose: without users who
    // never convert, precision metrics look far better than they should.
    share: 0.15,
    sessions: [10, 22],
    viewsPerSession: [3, 8],
    onTargetBias: 0.35,
    cartRate: 0.06,
    purchaseRate: 0.05,
    searchRate: 0.8,
    usesBrand: false,
    narrowPrice: false,
  },
];

// Keyword fragments a shopper might type. Combined with a real category or
// brand name so search history is not pure noise.
const SEARCH_PREFIXES = ["", "mua ", "gia ", "review "];
const SEARCH_SUFFIXES = ["", " gia re", " moi", " chinh hang", " tot nhat"];

const DAY_MS = 86400000;

// Timestamps are anchored to the start of the current UTC day, not to
// Date.now(). Anchoring to the exact millisecond would make two runs with the
// same seed differ in every timestamp, which breaks the one promise this
// generator has to keep: "seed 42 produces this dataset". Callers that need a
// dataset fixed across days can pass `now` explicitly.
const startOfUtcDay = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;

/**
 * Zipf-like popularity: rank 1 gets the most attention, and it falls away
 * quickly. Real catalogues have a long tail, and without one the popularity
 * component of the hybrid score has nothing to distinguish.
 */
const buildPopularity = (products, rng) => {
  const ranked = rng.shuffle(products);
  const weights = new Map();

  ranked.forEach((product, index) => {
    weights.set(product.id, 1 / (index + 1));
  });

  return weights;
};

const priceOf = (product) => {
  const sale = Number(product.salePrice);
  const base = Number(product.basePrice);
  return sale > 0 && sale < base ? sale : base;
};

// Turn an archetype into a concrete taste against the real catalogue.
const instantiatePersona = (type, index, catalogue, rng) => {
  const { products, categoriesWithProducts, brandsWithProducts } = catalogue;

  const categoryId = type.brandAcrossCategories ? null : rng.pick(categoriesWithProducts);
  const brandId = type.usesBrand ? rng.pick(brandsWithProducts) : null;

  // The candidate set this shopper is "really" interested in.
  let target = products.filter(
    (p) => (!categoryId || p.categoryId === categoryId) && (!brandId || p.brandId === brandId),
  );

  // A taste nobody in the catalogue satisfies would generate no usable signal.
  if (target.length < 2) {
    target = products.filter((p) => (categoryId ? p.categoryId === categoryId : true));
  }
  if (target.length < 2) {
    target = products;
  }

  const prices = target.map(priceOf).sort((a, b) => a - b);

  let minPrice = prices[0];
  let maxPrice = prices[prices.length - 1];

  if (type.cheapestBand) {
    maxPrice = prices[Math.floor(prices.length * 0.4)] || maxPrice;
  } else if (type.narrowPrice) {
    const anchor = rng.pick(prices);
    minPrice = anchor * 0.7;
    maxPrice = anchor * 1.3;
  }

  const inBand = target.filter((p) => priceOf(p) >= minPrice && priceOf(p) <= maxPrice);

  return {
    key: `${type.key}_${String(index + 1).padStart(3, "0")}`,
    type: type.key,
    // The answer key. Never written into the user's preference profile — that
    // is the thing under test.
    truth: {
      categoryId,
      brandId,
      minPrice: Math.round(minPrice),
      maxPrice: Math.round(maxPrice),
      targetProductIds: (inBand.length >= 2 ? inBand : target).map((p) => p.id),
    },
    targetProducts: inBand.length >= 2 ? inBand : target,
  };
};

const buildKeyword = (persona, catalogue, rng) => {
  const { categoryNames, brandNames } = catalogue;
  const parts = [];

  if (persona.truth.brandId && brandNames.get(persona.truth.brandId)) {
    parts.push(brandNames.get(persona.truth.brandId));
  }
  if (persona.truth.categoryId && categoryNames.get(persona.truth.categoryId)) {
    parts.push(categoryNames.get(persona.truth.categoryId));
  }
  if (parts.length === 0) {
    parts.push(rng.pick([...categoryNames.values()]));
  }

  return `${rng.pick(SEARCH_PREFIXES)}${parts.join(" ")}${rng.pick(SEARCH_SUFFIXES)}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 120);
};

/**
 * @returns {{ personas: Array, behaviors: Array, searches: Array, stats: Object }}
 */
const buildSimulationPlan = ({ products, categories, brands, users = 60, days = 90, seed = 42, now = null }) => {
  if (!products || products.length < 3) {
    throw new Error("The catalogue needs at least 3 active products to simulate against");
  }

  const rng = createRandom(seed);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const brandNames = new Map(brands.map((b) => [b.id, b.name]));

  const catalogue = {
    products,
    categoryNames,
    brandNames,
    categoriesWithProducts: [...new Set(products.map((p) => p.categoryId).filter(Boolean))],
    brandsWithProducts: [...new Set(products.map((p) => p.brandId).filter(Boolean))],
  };

  const popularity = buildPopularity(products, rng);
  const allWeights = products.map((p) => popularity.get(p.id));

  // Expand the archetype shares into a concrete roster.
  const roster = [];
  PERSONA_TYPES.forEach((type) => {
    const count = Math.max(1, Math.round(users * type.share));
    for (let i = 0; i < count && roster.length < users; i += 1) {
      roster.push(type);
    }
  });
  while (roster.length < users) {
    roster.push(PERSONA_TYPES[0]);
  }

  const personas = [];
  const behaviors = [];
  const searches = [];
  const anchor = now === null ? startOfUtcDay(Date.now()) : now;
  const stats = { VIEW_PRODUCT: 0, ADD_TO_CART: 0, PURCHASE: 0, SEARCH: 0, FAVORITE: 0 };

  roster.slice(0, users).forEach((type, index) => {
    const persona = instantiatePersona(type, index, catalogue, rng);
    const sessionCount = rng.int(type.sessions[0], type.sessions[1]);

    // Sessions are spread over the window and each is a burst of activity,
    // rather than events scattered uniformly: people shop in sittings.
    const sessionDays = rng
      .shuffle(Array.from({ length: days }, (_, d) => d))
      .slice(0, sessionCount)
      .sort((a, b) => b - a);

    sessionDays.forEach((dayOffset) => {
      const sessionStart = anchor - dayOffset * DAY_MS - rng.int(0, 20) * 3600000;
      let cursor = sessionStart;

      const push = (behaviorType, product, metadata = null) => {
        cursor += rng.int(20, 240) * 1000;
        behaviors.push({
          userId: null, // filled in by the writer once the user row exists
          personaKey: persona.key,
          sessionId: null,
          behaviorType,
          productId: product ? product.id : null,
          categoryId: product ? product.categoryId : null,
          metadata,
          occurredAt: new Date(cursor),
        });
        stats[behaviorType] = (stats[behaviorType] || 0) + 1;
      };

      if (rng.chance(type.searchRate)) {
        const keyword = buildKeyword(persona, catalogue, rng);
        searches.push({
          userId: null,
          personaKey: persona.key,
          keyword,
          categoryId: persona.truth.categoryId,
          filters: null,
          resultCount: rng.int(0, 30),
          searchedAt: new Date(cursor),
        });
        push("SEARCH", null, { keyword });
      }

      const viewCount = rng.int(type.viewsPerSession[0], type.viewsPerSession[1]);
      const seenThisSession = new Set();

      for (let v = 0; v < viewCount; v += 1) {
        // Mostly on-taste, sometimes not — a shopper who only ever looks at
        // exactly what they want is a dataset the recommender cannot be wrong
        // about, which makes the evaluation meaningless.
        const onTarget = rng.chance(type.onTargetBias);
        const product = onTarget
          ? rng.pick(persona.targetProducts)
          : rng.pickWeighted(products, allWeights);

        // Mirrors the 30-minute view dedup the live tracker applies, so the
        // synthetic data has the same shape as data collected for real.
        if (seenThisSession.has(product.id)) {
          continue;
        }
        seenThisSession.add(product.id);

        push("VIEW_PRODUCT", product);

        if (rng.chance(type.cartRate)) {
          const quantity = rng.chance(0.85) ? 1 : rng.int(2, 3);
          push("ADD_TO_CART", product, { quantity });

          if (rng.chance(type.purchaseRate)) {
            push("PURCHASE", product, { quantity, unitPrice: priceOf(product), simulated: true });
          }
        } else if (rng.chance(0.08)) {
          push("FAVORITE", product);
        }
      }
    });

    personas.push({
      key: persona.key,
      type: persona.type,
      truth: persona.truth,
    });
  });

  return { personas, behaviors, searches, stats };
};

module.exports = { buildSimulationPlan, PERSONA_TYPES };
