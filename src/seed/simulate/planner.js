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
 * ── PERSONA KHÔNG ĐỒNG NHẤT (2026-09-08) ─────────────────────────────────────
 *
 * Bản trước có một khiếm khuyết làm hỏng câu hỏi trung tâm của chương Đánh giá.
 * Cả 60 persona đều được định nghĩa bằng (danh mục, hãng, khoảng giá) — đúng ba
 * trường mà `scoreUserPreference` đọc. Nên **mọi persona đều giải được bằng một
 * thành phần duy nhất**, và `resolveWeights` — cơ chế thích ứng trọng số theo
 * từng khách — chưa bao giờ được đặt vào tình huống nó sinh ra để xử lý. Hệ quả
 * đo được: hybrid trúng đúng bằng `userPreference`, và bảy bộ trọng số khác nhau
 * cho cùng một con số.
 *
 * Hybrid chỉ thắng thành phần đơn lẻ khi **các khách khác nhau cần các thành
 * phần khác nhau**. Ba archetype dưới đây tồn tại để tạo ra đúng tình huống đó:
 *
 *   RESEARCHER       ý định nằm ở TỪ KHOÁ, không nằm ở lịch sử xem (xem trải
 *                    rộng vì đang so sánh) → chỉ `searchHistory` với tới được
 *   EXPLORING        cam kết (giỏ/mua) ở gu A, xem gần đây chuyển sang gu B →
 *                    hệ thống phải GIỮ được A trong khi vẫn để lọt B
 *   SHIFTING_INTENT  nhu cầu đổi hẳn sang B → hệ thống phải BẮT KỊP
 *
 * Hai archetype cuối cố ý đảo hạng của nhau (xem `truth.targets`): một hệ thống
 * chỉ biết bám gu cũ ăn điểm `EXPLORING` nhưng trượt `SHIFTING_INTENT`; một hệ
 * thống chạy theo cái mới nhất thì ngược lại. Chỉ hệ thống cân được **tín hiệu
 * mạnh** với **tín hiệu mới** mới ăn điểm cả hai — và đó đúng là thứ hybrid phải
 * chứng minh.
 *
 * `BARGAIN_HUNTER` bị bỏ: gu của nó là giá, mà giá cũng nằm trong
 * `scoreUserPreference`, nên nó không tách được thành phần nào khỏi thành phần nào.
 *
 * This module is pure: it reads a catalogue and returns a plan. Nothing here
 * touches the database, so the distributions can be tested directly.
 */

// Shopper archetypes. The funnel probabilities differ per persona because real
// shoppers differ: a decided buyer converts, a browser mostly looks.
//
// `share` cộng lại bằng 1. Với `--users=120` thì ra 24/24/18/18/12/12/12.
const PERSONA_TYPES = [
  {
    key: "FOCUSED_BUYER",
    // Knows what they want: one category, one brand, a narrow budget.
    share: 0.2,
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
    share: 0.2,
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
    share: 0.15,
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
    key: "RESEARCHER",
    /**
     * Đang gom cả một bộ thiết bị: tìm kiếm rất cụ thể một món, nhưng lịch sử xem
     * thì trải khắp catalogue (laptop, rồi màn hình, rồi chuột).
     *
     * `onTargetBias` thấp là điểm mấu chốt — lịch sử xem KHÔNG chỉ ra ý định, nên
     * `userPreference` và `productSimilarity` (đều ăn theo lịch sử xem) mất dấu.
     * Ý định chỉ còn nằm trong từ khoá, và `scoreSearchHistory` là thành phần duy
     * nhất đọc được nó.
     *
     * **Đặt 0.20, không phải 0.40 (2026-09-08).** Ở 0.40 archetype này KHÔNG cô
     * lập được gì: đo thật cho `userPreference` 0.761 còn `searchHistory` 0.418.
     * Catalogue chỉ có 8 danh mục có hàng, nên 40% lượt xem dồn vào một danh mục
     * vẫn thừa đủ để hồ sơ khôi phục ra danh mục đó. Con số này là một lựa chọn
     * mô hình hoá, không phải hằng số tinh chỉnh cho đẹp số: nó chốt cách đọc
     * archetype là "gom một bộ setup" (xem xuyên danh mục) chứ không phải "so sánh
     * trong một danh mục" (xem tập trung) — và chỉ cách đọc thứ nhất mới tạo ra
     * một khách mà lịch sử xem im lặng còn từ khoá thì không.
     *
     * `searchesProductNames` đổi cách sinh từ khoá: `buildKeyword` mặc định ghép
     * tên HÃNG + tên DANH MỤC, tức nằm đúng trong không gian đặc trưng mà
     * `userPreference` đã đọc — dùng nó thì archetype này không tách được gì.
     * `scoreSearchHistory` khớp token với `product.name`, nên từ khoá phải sinh
     * từ tên sản phẩm mới đi vào đúng kênh đó.
     */
    share: 0.15,
    sessions: [8, 16],
    viewsPerSession: [4, 9],
    onTargetBias: 0.2,
    cartRate: 0.22,
    purchaseRate: 0.4,
    searchRate: 0.85,
    usesBrand: false,
    narrowPrice: false,
    searchesProductNames: true,
  },
  {
    key: "EXPLORING",
    /**
     * Cam kết ở gu A, dạo xem gu B. Ví dụ đời thật: giỏ hàng toàn Dell, mấy hôm
     * nay click xem ASUS.
     *
     * `commitmentStays` giữ mọi lượt giỏ/mua ở gu A kể cả sau mốc chuyển, chỉ có
     * lượt XEM và TÌM là chuyển sang B. Bỏ Dell khỏi gợi ý vì vài cú click ASUS
     * là sai; bỏ hẳn ASUS cũng sai. Đáp án vì vậy có hạng: A là `primary`
     * (rel = 2), B là `secondary` (rel = 1).
     */
    share: 0.1,
    sessions: [8, 16],
    viewsPerSession: [3, 7],
    onTargetBias: 0.8,
    cartRate: 0.3,
    purchaseRate: 0.5,
    searchRate: 0.6,
    usesBrand: false,
    narrowPrice: false,
    twoPhase: true,
    commitmentStays: true,
  },
  {
    key: "SHIFTING_INTENT",
    /**
     * Nhu cầu đổi thật: mua xong laptop, giờ cần tai nghe. Sau mốc chuyển thì cả
     * xem, tìm lẫn mua đều sang gu B.
     *
     * Hạng ĐẢO so với `EXPLORING`: B là `primary`, A là `secondary`. Gu cũ không
     * về 0 — mua laptop xong vẫn có thể quan tâm laptop — nhưng nó phải xếp sau.
     *
     * Đây là archetype khai thác một khiếm khuyết THẬT của thiết kế hiện tại:
     * `recomputeProfile` cộng `total × SIGNAL_WEIGHTS` trên cửa sổ 90 ngày phẳng,
     * KHÔNG có số hạng thời gian, trong khi `scoreSearchHistory` (1/(i+1)) và
     * `scoreProductSimilarity` (1/(viewedRank+1)) đều suy giảm theo thời gian.
     * Hai thành phần tôn trọng tính thời sự, một thành phần chiếm trọng số lớn
     * nhất thì không.
     */
    share: 0.1,
    sessions: [8, 16],
    viewsPerSession: [3, 7],
    onTargetBias: 0.8,
    cartRate: 0.3,
    purchaseRate: 0.5,
    searchRate: 0.6,
    usesBrand: false,
    narrowPrice: false,
    twoPhase: true,
    commitmentStays: false,
  },
  {
    key: "WINDOW_SHOPPER",
    // Lots of looking, almost no buying. Present on purpose: without users who
    // never convert, precision metrics look far better than they should.
    share: 0.1,
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

/**
 * Một "gu" cụ thể dựng trên catalogue thật: danh mục, hãng, khoảng giá, và tập
 * sản phẩm thoả cả ba.
 *
 * Tách khỏi `instantiatePersona` vì persona hai pha cần DỰNG HAI LẦN, và lần thứ
 * hai phải tránh danh mục của lần đầu — nếu hai gu rơi vào cùng danh mục thì
 * "chuyển ý định" không còn là chuyển gì cả, và archetype đó đo cùng thứ với
 * `CATEGORY_LOYAL`.
 */
const instantiateTaste = (type, catalogue, rng, { avoidCategoryId = null } = {}) => {
  const { products, categoriesWithProducts, brandsWithProducts } = catalogue;

  const pool = avoidCategoryId
    ? categoriesWithProducts.filter((id) => id !== avoidCategoryId)
    : categoriesWithProducts;

  const categoryId = type.brandAcrossCategories
    ? null
    : rng.pick(pool.length > 0 ? pool : categoriesWithProducts);
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
    categoryId,
    brandId,
    minPrice: Math.round(minPrice),
    maxPrice: Math.round(maxPrice),
    products: inBand.length >= 2 ? inBand : target,
  };
};

/**
 * Turn an archetype into a concrete taste (or two) against the real catalogue.
 *
 * `truth.targets` có HAI HẠNG, và hạng là thứ chương Đánh giá chấm điểm:
 *   primary   (rel = 2) — thứ hệ thống phải xếp lên đầu
 *   secondary (rel = 1) — thứ hệ thống được thưởng khi để lọt vào, nhưng ít hơn
 *
 * Persona một gu thì `secondary` rỗng. Persona hai pha thì hạng phụ thuộc vào
 * archetype, và đó chính là chỗ phép đo có răng — xem chú thích ở `EXPLORING` và
 * `SHIFTING_INTENT`.
 */
const instantiatePersona = (type, index, catalogue, rng, days) => {
  const earlyTaste = instantiateTaste(type, catalogue, rng);

  const lateTaste = type.twoPhase
    ? instantiateTaste(type, catalogue, rng, { avoidCategoryId: earlyTaste.categoryId })
    : null;

  /**
   * Mốc chuyển, tính bằng "số ngày trước hôm nay". Phiên có `dayOffset` LỚN hơn
   * mốc là phiên cũ (pha đầu); nhỏ hơn hoặc bằng là phiên mới (pha sau).
   *
   * Đặt trong khoảng 35–55% cửa sổ để cả hai pha đều đủ dữ liệu. Đặt quá sát một
   * đầu thì một trong hai gu chỉ có vài sự kiện và archetype không đo được gì.
   */
  const shiftDay = type.twoPhase ? rng.int(Math.round(days * 0.35), Math.round(days * 0.55)) : null;

  // `commitmentStays` giữ cam kết ở gu đầu, nên gu đầu mới là thứ phải xếp trên.
  // Ngược lại thì gu sau là thứ hệ thống phải bắt kịp.
  const primaryTaste = lateTaste && !type.commitmentStays ? lateTaste : earlyTaste;
  const secondaryTaste = lateTaste ? (primaryTaste === earlyTaste ? lateTaste : earlyTaste) : null;

  /**
   * `RESEARCHER` tìm kiếm theo tên MỘT sản phẩm cụ thể, và sản phẩm đó bị hạ
   * xuống hạng phụ.
   *
   * Nếu để nó trong `primary` thì `searchHistory` chỉ cần khớp lại đúng chuỗi vừa
   * gõ là trúng — học thuộc đáp án, không phải khái quát hoá. Bỏ nó ra khỏi hạng
   * chính buộc thành phần đó phải với sang những sản phẩm CÙNG DÒNG mà khách chưa
   * gõ tên. Vẫn để ở `secondary` vì tìm X rồi được gợi ý X là một kết quả hợp lệ,
   * chỉ không phải thứ đáng thưởng nhất.
   */
  const seedProduct = type.searchesProductNames ? rng.pick(earlyTaste.products) : null;

  let primaryProducts = primaryTaste.products;
  let secondaryProducts = secondaryTaste ? secondaryTaste.products : [];

  if (seedProduct) {
    const withoutSeed = primaryProducts.filter((p) => p.id !== seedProduct.id);
    if (withoutSeed.length >= 1) {
      primaryProducts = withoutSeed;
      secondaryProducts = [seedProduct];
    }
  }

  return {
    key: `${type.key}_${String(index + 1).padStart(3, "0")}`,
    type: type.key,
    // The answer key. Never written into the user's preference profile — that
    // is the thing under test.
    truth: {
      categoryId: primaryTaste.categoryId,
      brandId: primaryTaste.brandId,
      minPrice: primaryTaste.minPrice,
      maxPrice: primaryTaste.maxPrice,
      targets: {
        primary: primaryProducts.map((p) => p.id),
        secondary: secondaryProducts.map((p) => p.id),
      },
      shiftDay,
      // Gu phụ ghi lại đầy đủ để chương Đánh giá giải thích được ca sai: "hệ
      // thống trả về gu cũ" là một câu nói được, "hệ thống trả sai" thì không.
      secondaryTaste: secondaryTaste
        ? { categoryId: secondaryTaste.categoryId, brandId: secondaryTaste.brandId }
        : null,
      seedProductId: seedProduct ? seedProduct.id : null,
    },
    earlyTaste,
    lateTaste,
    seedProduct,
  };
};

/**
 * Từ khoá tìm kiếm.
 *
 * Mặc định ghép tên HÃNG + tên DANH MỤC của gu đang hoạt động. `fromProduct` đổi
 * sang tên sản phẩm: lấy tối đa ba từ có nghĩa đầu tiên, vì `tokenizeFolded` bỏ
 * token dưới 3 ký tự và `scoreSearchHistory` khớp chuỗi con vào `product.name`.
 * Ba từ đầu của "Apple MacBook Pro 14 inch M3 Pro (18GB / 512GB SSD)" là
 * "apple macbook pro" — đủ hẹp để chỉ ra dòng sản phẩm, đủ rộng để còn khớp được
 * sang máy cùng dòng mà khách chưa gõ tên.
 */
const buildKeyword = (taste, catalogue, rng, { fromProduct = null } = {}) => {
  const { categoryNames, brandNames } = catalogue;
  const parts = [];

  if (fromProduct) {
    const words = String(fromProduct.name)
      .replace(/\(.*?\)/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3)
      .slice(0, 3);
    parts.push(words.join(" "));
  } else {
    if (taste.brandId && brandNames.get(taste.brandId)) {
      parts.push(brandNames.get(taste.brandId));
    }
    if (taste.categoryId && categoryNames.get(taste.categoryId)) {
      parts.push(categoryNames.get(taste.categoryId));
    }
    if (parts.length === 0) {
      parts.push(rng.pick([...categoryNames.values()]));
    }
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

  /**
   * Sắp lại catalogue theo `slug` TRƯỚC khi bất cứ thứ gì rút ra từ nó.
   *
   * Đây là điều kiện để lời hứa "seed 42 sinh ra đúng bộ dữ liệu này" thành
   * thật, và trước thay đổi này nó KHÔNG thật. `db.Product.findAll` không có
   * `ORDER BY` nên MySQL trả về theo thứ tự khoá chính, tức thứ tự UUID; UUID
   * lại sinh mới mỗi lượt `seed:catalog`. Ba chỗ ăn theo thứ tự đó:
   *
   *   1. `buildPopularity` chạy Fisher-Yates trên mảng này. Cùng một dãy số
   *      ngẫu nhiên nhưng đầu vào xếp khác thì kết quả khác, nên sản phẩm nào
   *      được hạng 1 (trọng số 1/1) đổi theo mỗi lượt seed.
   *   2. `categoriesWithProducts` / `brandsWithProducts` dựng bằng
   *      `products.map(...)`, nên thứ tự của chúng — thứ mà `rng.pick` chọn
   *      persona từ đó — cũng đổi.
   *   3. `instantiateTaste` lọc `products` và giữ nguyên thứ tự đầu vào, nên
   *      `truth.targets`, tức CHÍNH ĐÁP ÁN của phép đo, cũng đổi.
   *
   * Hệ quả đo được: cùng seed 42, cùng 24 sản phẩm, bốn lượt seed liên tiếp cho
   * 3129 / 3252 / 3335 / 3592 sự kiện, và "hybrid hơn ngẫu nhiên" dao động từ
   * +141.7% tới +242% — con số headline của chương Đánh giá phụ thuộc vào việc
   * UUID nào tình cờ được sinh ra. `slug` có unique index và không đổi giữa các
   * lượt seed, nên sắp theo nó là bỏ hẳn phụ thuộc đó.
   */
  const ordered = [...products].sort((a, b) => String(a.slug).localeCompare(String(b.slug)));

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const brandNames = new Map(brands.map((b) => [b.id, b.name]));

  const catalogue = {
    products: ordered,
    categoryNames,
    brandNames,
    categoriesWithProducts: [...new Set(ordered.map((p) => p.categoryId).filter(Boolean))],
    brandsWithProducts: [...new Set(ordered.map((p) => p.brandId).filter(Boolean))],
  };

  const popularity = buildPopularity(ordered, rng);
  const allWeights = ordered.map((p) => popularity.get(p.id));

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
    const persona = instantiatePersona(type, index, catalogue, rng, days);
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

      // `dayOffset` là "số ngày trước hôm nay", nên phiên MỚI có offset NHỎ.
      const isLatePhase = persona.truth.shiftDay !== null && dayOffset <= persona.truth.shiftDay;

      // Gu đang được XEM và TÌM trong phiên này.
      const activeTaste = isLatePhase && persona.lateTaste ? persona.lateTaste : persona.earlyTaste;
      // Gu mà lượt GIỎ/MUA rơi vào. Khác `activeTaste` đúng ở `EXPLORING` sau mốc
      // chuyển: xem ASUS nhưng vẫn mua Dell.
      const commitTaste = type.commitmentStays ? persona.earlyTaste : activeTaste;

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
        const keyword = buildKeyword(activeTaste, catalogue, rng, { fromProduct: persona.seedProduct });
        searches.push({
          userId: null,
          personaKey: persona.key,
          keyword,
          categoryId: activeTaste.categoryId,
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
          ? rng.pick(activeTaste.products)
          // `ordered`, không phải `products`: `allWeights` được tính theo thứ tự
          // của `ordered`, nên ghép nó với mảng chưa sắp sẽ gán trọng số của sản
          // phẩm này cho sản phẩm khác.
          : rng.pickWeighted(ordered, allWeights);

        // Mirrors the 30-minute view dedup the live tracker applies, so the
        // synthetic data has the same shape as data collected for real.
        if (seenThisSession.has(product.id)) {
          continue;
        }
        seenThisSession.add(product.id);

        push("VIEW_PRODUCT", product);

        if (rng.chance(type.cartRate)) {
          /**
           * Lượt chuyển đổi rơi vào gu CAM KẾT, có thể khác món vừa xem.
           *
           * Khi khác, phải đẩy thêm một lượt xem của chính món đó trước khi cho
           * vào giỏ: bất biến "mọi purchase đều có add-to-cart trước đó cùng sản
           * phẩm, và mọi add-to-cart đều có view trước đó" là thứ làm phễu của bộ
           * dữ liệu giống phễu thật (README 6.3). Phá nó ở đây thì `EXPLORING`
           * sinh ra những lượt mua từ trên trời rơi xuống.
           */
          const converted = commitTaste === activeTaste ? product : rng.pick(commitTaste.products);

          if (converted.id !== product.id && !seenThisSession.has(converted.id)) {
            seenThisSession.add(converted.id);
            push("VIEW_PRODUCT", converted);
          }

          const quantity = rng.chance(0.85) ? 1 : rng.int(2, 3);
          push("ADD_TO_CART", converted, { quantity });

          if (rng.chance(type.purchaseRate)) {
            push("PURCHASE", converted, { quantity, unitPrice: priceOf(converted), simulated: true });
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
