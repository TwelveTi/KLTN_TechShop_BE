const AppError = require("../utils/AppError");
const recommendationRepository = require("../repositories/recommendationRepository");
// Chỉ dùng ở đường `asOf` (đo tách theo thời gian): dựng lại hồ sơ sở thích tại
// một mốc quá khứ. `behaviorService` không require ngược lại đây, nên không có
// vòng phụ thuộc.
const behaviorService = require("./behaviorService");
const { computeContentSimilarity, priceOf } = require("../utils/similarity");
const { foldDiacritics, tokenizeFolded } = require("../utils/textTokens");
const logger = require("../utils/logger");

/**
 * The recommendation engine.
 *
 * Five scoring components are computed independently, each normalised to [0, 1],
 * then combined by the weights below (README section 6). Keeping them separate
 * is what makes the evaluation chapter possible: each component can be run alone
 * and compared against the hybrid, and every recommendation can say which
 * component won — that reason is what the AI explanation feature reads.
 */
const HYBRID_WEIGHTS = {
  userPreference: 0.35,
  searchHistory: 0.25,
  purchaseHistory: 0.2,
  productSimilarity: 0.1,
  popularity: 0.1,
};

/**
 * Bốn thành phần cá nhân hoá. `popularity` cố ý KHÔNG nằm ở đây.
 *
 * Đo được (README 6.4, hai catalogue độc lập): popularity đạt 9.2% precision@10
 * trong khi bốc ngẫu nhiên đạt 13.5%. Nó **tệ hơn ngẫu nhiên**, và hợp lý khi
 * nghĩ kỹ — sản phẩm phổ biến thì phổ biến với *mọi* người, nên khó nằm trong
 * tập quan tâm hẹp của một người cụ thể. Cho nó góp 10% vào mọi lượt là chủ động
 * pha nhiễu vào một danh sách đã có tín hiệu thật.
 *
 * Nó vẫn cần thiết, nhưng với vai trò khác: xem `resolveWeights` và phần lấp
 * chỗ trống ở `getForUser`.
 */
const PERSONAL_KEYS = ["userPreference", "searchHistory", "purchaseHistory", "productSimilarity"];

/**
 * Phần của phép ghép dành cho `popularity` KHI khách đã có tín hiệu cá nhân.
 *
 * `0` là hành vi `hybrid-v2`: popularity bị loại hẳn khỏi tổng, chỉ còn là phương
 * án dự phòng và phần lấp đuôi. Đặt `0.10` là quay về hành vi `v1`.
 *
 * Lộ ra để harness đo lường quét thử, giống `HYBRID_WEIGHTS` — xem
 * `measure.js --popsweep`. Bằng chứng cũ cho việc chọn `0` (README 6.4.1:
 * "popularity tệ hơn ngẫu nhiên") đã được chứng minh là **không hợp lệ**: lúc đó
 * `simulate` không cập nhật `soldCount`/`viewCount` nên popularity đang được chấm
 * trên số viết tay trong `products.data.js`. Nên con số này phải được chọn lại
 * bằng số, trên cả hai giao thức và cả hai seed.
 */
const POPULARITY_BLEND = { weight: 0 };

// Bumped whenever the formula changes, and stored on every result. Without it,
// numbers measured before and after a tweak are silently incomparable.
const ALGORITHM_VERSION = "hybrid-v2";

// Which component produced a product's score, in the order a person would find
// most convincing as an explanation.
const REASON_CODES = {
  userPreference: "MATCHES_YOUR_TASTE",
  searchHistory: "MATCHES_YOUR_SEARCH",
  purchaseHistory: "LIKE_WHAT_YOU_BOUGHT",
  productSimilarity: "SIMILAR_TO_VIEWED",
  popularity: "POPULAR_NOW",
};

const RECENCY_WINDOW_DAYS = 90;
const CACHE_MINUTES = 15;
const DEFAULT_LIMIT = 12;

/**
 * Những `strategy` mà một dòng đã lưu được phép dùng lại cho request sau.
 *
 * Chỉ hai giá trị này là kết quả của phép ghép đầy đủ. Một dòng sinh ra bởi
 * `?strategy=popularity` chứa danh sách của MỘT thành phần; trả nó cho một
 * request không ép strategy là nói sai về phép tính đã chạy, và `findFreshResult`
 * thì không lọc theo strategy nên phải chặn ở đây.
 *
 * Dòng cũ hơn thay đổi này không ghi `strategy` vào `context`, nên cũng rơi vào
 * nhánh này và bị tính lại — đúng, vì không có cách nào biết nó là `hybrid` hay
 * `popularity-fallback`.
 */
const CACHEABLE_STRATEGIES = new Set(["hybrid", "popularity-fallback"]);

// Behaviour types that mean "already dealt with this product" — recommending
// something a shopper just bought is the most visible way to look broken.
const SATISFIED_TYPES = ["PURCHASE"];

class RecommendationService {
  // ── Normalisation helpers ─────────────────────────────────────────────────

  // Scores are only comparable once they are on the same scale, so every
  // component is divided by the best value seen in this run rather than by an
  // absolute constant that would drift as the catalogue grows.
  normalise(scores) {
    const max = Math.max(...Object.values(scores), 0);

    if (max <= 0) {
      return {};
    }

    const out = {};
    Object.entries(scores).forEach(([id, value]) => {
      out[id] = value / max;
    });
    return out;
  }

  // ── 1. Rule-based / user preference ───────────────────────────────────────

  /**
   * Scores a product against the shopper's stored preference profile:
   * preferred category, preferred brand, and whether it sits in their budget.
   *
   * This is the "rule-based" algorithm from README 6: a laptop shopper who buys
   * Asus around 20M gets Asus laptops in that band ranked first.
   */
  scoreUserPreference(products, profile) {
    if (!profile) {
      return {};
    }

    const categoryRank = new Map((profile.preferredCategories || []).map((c, i) => [c.id, i]));
    const brandRank = new Map((profile.preferredBrands || []).map((b, i) => [b.id, i]));
    const min = profile.minPrice === null ? null : Number(profile.minPrice);
    const max = profile.maxPrice === null ? null : Number(profile.maxPrice);

    const scores = {};

    products.forEach((product) => {
      let score = 0;

      // Rank-decayed, not binary: the top preferred category counts for more
      // than the fifth one.
      if (categoryRank.has(product.categoryId)) {
        score += 0.45 / (categoryRank.get(product.categoryId) + 1);
      }
      if (brandRank.has(product.brandId)) {
        score += 0.35 / (brandRank.get(product.brandId) + 1);
      }

      if (min !== null && max !== null) {
        const price = priceOf(product);
        if (price >= min && price <= max) {
          score += 0.2;
        } else {
          // Just outside the band still counts for something — budgets are soft.
          const distance = price < min ? min - price : price - max;
          const span = Math.max(max - min, 1);
          score += 0.2 * Math.max(0, 1 - distance / span) * 0.5;
        }
      }

      if (score > 0) {
        scores[product.id] = score;
      }
    });

    return this.normalise(scores);
  }

  // ── 2. Search history ─────────────────────────────────────────────────────

  /**
   * Matches recent search keywords against product names.
   *
   * Recency-weighted: what someone searched yesterday says more than what they
   * searched two months ago. Từ khoá được tách thành token nên "laptop gaming"
   * khớp được "Gaming Laptop" dù thứ tự từ khác; phía tên sản phẩm vẫn là khớp
   * chuỗi con, nên một token ngắn có thể khớp giữa từ — đó là lý do
   * `tokenizeFolded` bỏ token dưới 3 ký tự.
   *
   * Chỉ khớp `product.name`. Mô tả, tên thương hiệu, tên danh mục và tag đều
   * không tham gia, nên "tai nghe chống ồn" không với được tới một sản phẩm mà
   * tên không chứa mấy từ đó — món nợ còn lại của thành phần này.
   */
  scoreSearchHistory(products, keywords) {
    if (!keywords || keywords.length === 0) {
      return {};
    }

    const tokenised = keywords.map((entry, index) => ({
      // Weight decays with position; the list arrives newest-first.
      weight: 1 / (index + 1),
      // Bỏ dấu TRƯỚC khi tách. Tách trực tiếp trên chuỗi còn dấu thì chữ có dấu
      // không tách từ mà băm từ thành vụn: "bàn phím không dây gõ êm" ra mảng
      // rỗng, "đồng hồ thông minh" chỉ còn ["minh"], "chuột" thành "chu" rồi
      // khớp bừa mọi tên chứa "chu". Xem utils/textTokens.
      tokens: tokenizeFolded(entry.keyword),
    }));

    const scores = {};

    products.forEach((product) => {
      // Phải bỏ dấu cùng một cách với phía từ khoá, nếu không "dong" sẽ không
      // bao giờ gặp "đồng".
      const haystack = foldDiacritics(product.name);
      let score = 0;

      tokenised.forEach(({ weight, tokens }) => {
        if (tokens.length === 0) {
          return;
        }
        const hits = tokens.filter((token) => haystack.includes(token)).length;
        if (hits > 0) {
          score += weight * (hits / tokens.length);
        }
      });

      if (score > 0) {
        scores[product.id] = score;
      }
    });

    return this.normalise(scores);
  }

  // ── 3. Purchase history ───────────────────────────────────────────────────

  /**
   * Products resembling what the shopper has already bought — same category or
   * brand, similar price.
   *
   * Distinct from `productSimilarity` below, which keys off what was VIEWED.
   * Purchases are a far stronger statement of taste, which is why they carry
   * twice the weight.
   */
  scorePurchaseHistory(products, purchasedProducts) {
    if (purchasedProducts.length === 0) {
      return {};
    }

    const scores = {};

    products.forEach((product) => {
      let best = 0;

      purchasedProducts.forEach((bought) => {
        if (bought.id === product.id) {
          return;
        }
        const { score } = computeContentSimilarity(product, bought);
        best = Math.max(best, score);
      });

      if (best > 0) {
        scores[product.id] = best;
      }
    });

    return this.normalise(scores);
  }

  // ── 4. Product similarity (content-based, from the precomputed matrix) ────

  /**
   * Leans on the offline `ProductSimilarity` matrix, seeded from what the shopper
   * recently viewed. Reading a precomputed matrix keeps the request cheap; the
   * expensive O(n^2) pass runs in `rebuildSimilarityMatrix`.
   */
  scoreProductSimilarity(products, similarityRows, viewedRank) {
    if (similarityRows.length === 0) {
      return {};
    }

    const candidateIds = new Set(products.map((p) => p.id));
    const scores = {};

    similarityRows.forEach((row) => {
      if (!candidateIds.has(row.similarProductId)) {
        return;
      }

      // A product similar to something viewed recently beats one similar to
      // something viewed weeks ago.
      const recency = 1 / ((viewedRank.get(row.productId) ?? 20) + 1);
      const contribution = Number(row.score) * recency;

      scores[row.similarProductId] = Math.max(scores[row.similarProductId] || 0, contribution);
    });

    return this.normalise(scores);
  }

  // ── 5. Popularity ─────────────────────────────────────────────────────────

  /**
   * The cold-start fallback and the "trending" rail: what everyone is buying.
   *
   * Sales dominate, ratings adjust, views break ties. `log1p` compresses the
   * long tail so one runaway bestseller cannot flatten every other product's
   * score to nothing.
   */
  scorePopularity(products) {
    const scores = {};

    products.forEach((product) => {
      const sold = Math.log1p(Number(product.soldCount) || 0);
      const views = Math.log1p(Number(product.viewCount) || 0);
      const rating = Number(product.averageRating) || 0;
      const reviews = Math.log1p(Number(product.reviewCount) || 0);

      // A 5-star average from two reviews should not outrank 4.5 from two
      // hundred, so the rating is scaled by how much evidence backs it.
      const ratingSignal = (rating / 5) * Math.min(1, reviews / Math.log1p(50));

      const score = sold * 0.6 + ratingSignal * 0.25 + views * 0.15 + (product.isFeatured ? 0.1 : 0);

      if (score > 0) {
        scores[product.id] = score;
      }
    });

    return this.normalise(scores);
  }

  // ── Hybrid ────────────────────────────────────────────────────────────────

  /**
   * Weighted sum of the five components.
   *
   * Every candidate also records which component contributed most, so the result
   * can explain itself. A product that only ever scored on `popularity` is
   * honestly labelled POPULAR_NOW rather than dressed up as personalisation.
   */
  /**
   * Trọng số cho MỘT lượt gợi ý cụ thể, thay vì một hằng số áp cho mọi lượt.
   *
   * Hai điều chỉnh, cả hai đều do số đo ở README 6.4 chỉ ra:
   *
   * 1. **Chỉ chia trọng số cho thành phần thực sự có tín hiệu, rồi chuẩn hoá lại
   *    về tổng 1.** Bản v1 luôn cấp 25% cho `searchHistory` kể cả với khách chưa
   *    tìm kiếm bao giờ — phần đó không mất đi mà lặng lẽ hạ tỉ trọng của những
   *    thành phần đang có dữ liệu. Với khách CÓ tìm kiếm mà chưa mua gì,
   *    `searchHistory` giờ nhận 0.25/(0.35+0.25+0.10) ≈ 36% thay vì 25%. Đó
   *    chính là "nâng searchHistory ở những lượt nó bắn được", nhưng không phải
   *    bằng cách gõ một con số to hơn vào bảng.
   *
   * 2. **`popularity` bị loại hẳn khi có bất kỳ tín hiệu cá nhân nào**, và chỉ
   *    chiếm toàn bộ khi không còn gì khác. Nó không còn là một số hạng trong
   *    tổng, nó là phương án dự phòng.
   */
  resolveWeights(components) {
    const hasSignal = (key) => {
      const scores = components[key];
      if (!scores) return false;
      return Object.values(scores).some((value) => value > 0);
    };

    const active = PERSONAL_KEYS.filter(hasSignal);

    if (active.length === 0) {
      return { popularity: 1 };
    }

    const total = active.reduce((sum, key) => sum + HYBRID_WEIGHTS[key], 0);
    const share = POPULARITY_BLEND.weight;

    if (share <= 0) {
      return Object.fromEntries(active.map((key) => [key, HYBRID_WEIGHTS[key] / total]));
    }

    // `share` là phần của TOÀN BỘ phép ghép dành cho popularity; phần còn lại chia
    // cho các thành phần cá nhân theo đúng tỉ lệ cũ của chúng.
    const blended = Object.fromEntries(
      active.map((key) => [key, (HYBRID_WEIGHTS[key] / total) * (1 - share)]),
    );
    blended.popularity = share;

    return blended;
  }

  combine(products, components, { excludeIds = new Set(), weights = HYBRID_WEIGHTS } = {}) {
    const ranked = [];

    products.forEach((product) => {
      if (excludeIds.has(product.id)) {
        return;
      }

      let total = 0;
      let bestKey = null;
      let bestContribution = 0;
      const parts = {};

      Object.entries(weights).forEach(([key, weight]) => {
        const raw = components[key]?.[product.id] || 0;
        const contribution = raw * weight;

        total += contribution;
        parts[key] = Math.round(raw * 10000) / 10000;

        if (contribution > bestContribution) {
          bestContribution = contribution;
          bestKey = key;
        }
      });

      if (total <= 0) {
        return;
      }

      ranked.push({
        productId: product.id,
        score: Math.round(total * 10000) / 10000,
        reasonCode: bestKey ? REASON_CODES[bestKey] : "POPULAR_NOW",
        reasonMetadata: { parts, dominant: bestKey, algorithmVersion: ALGORITHM_VERSION },
      });
    });

    // Product id breaks ties so equal scores rank deterministically — otherwise
    // two runs on the same data could report different precision.
    ranked.sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));

    return ranked;
  }

  // ── Orchestration ─────────────────────────────────────────────────────────

  /**
   * @param {Object} options
   * @param {string|null} options.userId
   * @param {string|null} options.sessionId
   * @param {number} options.limit
   * @param {string|null} options.strategy  force a single component: 'popularity',
   *        'userPreference', … Used by the evaluation to compare one algorithm
   *        against the hybrid.
   * @param {Date|null} options.asOf  tính gợi ý **như nó đã là** tại thời điểm
   *        này: mọi hành vi và từ khoá từ đó trở đi bị giấu, và hồ sơ sở thích
   *        được dựng lại tại chỗ thay vì đọc bản đã lưu. Khe cắm thứ ba dành cho
   *        công cụ đo, cùng loại với `strategy` và `persist` — xem `measure.js
   *        --loo`. Không đường chạy thật nào truyền tham số này.
   */
  async getForUser({ userId = null, sessionId = null, limit = DEFAULT_LIMIT, strategy = null, persist = true, asOf = null }) {
    /**
     * Dùng lại dòng `recommendation_results` còn hạn trước khi tính lại bất cứ thứ gì.
     *
     * Đặt TRƯỚC `findScorableProducts` là cố ý — đọc cache mà vẫn nạp cả
     * catalogue thì không tiết kiệm được gì. Hai điều mỗi lượt tính lại phải trả
     * giá: một dòng "shown" mới làm loãng mẫu số CTR của chương Đánh giá, và một
     * bộ `itemId` mới làm mất lời giải thích AI đã lưu ở `reasonMetadata` (README 7.3).
     *
     * Ba điều kiện loại trừ, cả ba đều bắt buộc:
     *
     *  - **`!userId`** — khách vãng lai không có dòng nào để đọc. Xem nhánh dưới.
     *  - **`strategy`** — đường ép một thành phần đơn lẻ là đường đo lường, phải
     *    luôn tính lại (xem `CACHEABLE_STRATEGIES`).
     *  - **`!persist`** — gọi với `persist: false` là nói "đừng chạm vào bảng kết
     *    quả", và đọc cũng là chạm. `measure.js --sweep` chạy 7 bộ trọng số liên
     *    tiếp trên cùng một khách; nếu bộ thứ hai đọc lại dòng của bộ thứ nhất
     *    thì cả bảng quét chỉ là một con số nhân bảy.
     */
    // `asOf` cũng loại trừ cache, và vì một lý do khác ba lý do trên: một dòng đã
    // lưu là kết quả tính tại thời điểm nó được ghi, không phải tại mốc đang hỏi.
    if (userId && persist && !strategy && !asOf) {
      const cached = await this.readCachedResult({ userId, sessionId, limit });

      if (cached) {
        return cached;
      }
    }

    const products = await recommendationRepository.findScorableProducts();

    if (products.length === 0) {
      return { items: [], strategy: "empty-catalogue", algorithmVersion: ALGORITHM_VERSION };
    }

    // An anonymous visitor has no history to personalise from, so popularity is
    // the honest answer rather than a pretend-personalised list.
    if (!userId) {
      const popularity = this.scorePopularity(products);
      const ranked = this.combine(products, { popularity }).slice(0, limit);

      /**
       * Vẫn KHÔNG lưu, nên cũng không có gì để cache — và đó là lựa chọn, không
       * phải chỗ chưa làm. Cache cho khách vãng lai đòi phải lưu trước, mà lưu
       * thì đánh vào đúng hai con số việc này đang đi sửa:
       *
       *  1. **Mẫu số CTR.** `getOutcomeStats` đếm MỌI dòng `recommendation_items`,
       *     không lọc theo `recommendationType` lẫn `personalised`. Mỗi phiên
       *     khách lạ sẽ thêm 12 lượt "shown" của một danh sách bán chạy chung vào
       *     cùng mẫu số với dải cá nhân hoá — làm loãng đúng tỉ lệ chương Đánh giá
       *     đang đo, chỉ khác là loãng bằng 12 dòng mỗi 15 phút thay vì mỗi request.
       *  2. **Hạn mức Gemini.** Lời giải thích AI chỉ có nghĩa khi có tín hiệu để
       *     giải thích. Khách chưa có `userId` thì `collectExplanationSignals`
       *     trả rỗng và model chỉ nói được "sản phẩm đang bán chạy" — trả tiền
       *     hạn mức cho một câu suy ra được từ `reasonCode`.
       *
       * Đổi lại, đường này rẻ: một truy vấn catalogue rồi xếp hạng trong bộ nhớ,
       * không hồ sơ, không ma trận tương tự, không ghi gì. Chi phí một lượt tính
       * lại ở đây thấp hơn chi phí của dòng cache mà nó tiết kiệm được.
       *
       * Dải "sản phẩm tương tự" thì CÓ lưu cho khách vãng lai (`getSimilarProducts`
       * nhận `sessionId`) — khác biệt đó là cố ý và được ghi ở README 7.3.
       */
      return {
        // No outcome ids, because nothing was persisted: the client must not
        // invent one, and there is no user to attribute it to afterwards.
        items: await this.decorate(ranked),
        strategy: "popularity",
        algorithmVersion: ALGORITHM_VERSION,
        personalised: false,
        cached: false,
      };
    }

    // Cửa sổ 90 ngày trượt theo mốc đang hỏi. Neo nó vào `Date.now()` trong khi
    // `before` lùi về quá khứ sẽ đọc một cửa sổ rộng hơn 90 ngày, và hai lượt đo
    // ở hai mốc khác nhau sẽ chạy trên hai độ dài lịch sử khác nhau.
    const anchor = asOf ? asOf.getTime() : Date.now();
    const since = new Date(anchor - RECENCY_WINDOW_DAYS * 86400000);

    const [profile, behaviors, keywords] = await Promise.all([
      /**
       * Ở chế độ `asOf`, hồ sơ đã lưu là **hồ sơ của hôm nay** — nó được gộp từ
       * cả những hành vi sau mốc cắt, nên dùng nó là đưa đáp án cho mô hình.
       * Dựng lại tại chỗ với `persist: false`: một hồ sơ "tính tới ngày X" không
       * phải hồ sơ hiện tại của khách, ghi đè lên là làm hỏng dữ liệu thật.
       */
      asOf
        ? behaviorService.recomputeProfile(userId, { before: asOf, persist: false })
        : recommendationRepository.findProfile(userId),
      recommendationRepository.findRecentBehaviors(userId, { since, before: asOf }),
      recommendationRepository.findRecentKeywords(userId, { before: asOf }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));

    const purchasedIds = [
      ...new Set(behaviors.filter((b) => SATISFIED_TYPES.includes(b.behaviorType)).map((b) => b.productId)),
    ];
    const viewedIds = [
      ...new Set(behaviors.filter((b) => b.behaviorType === "VIEW_PRODUCT").map((b) => b.productId)),
    ];
    const viewedRank = new Map(viewedIds.map((id, index) => [id, index]));

    // Facets are needed for the content-based comparison against past purchases.
    const facetIds = [...new Set([...products.map((p) => p.id), ...purchasedIds])];
    const { tagsByProduct, specsByProduct } = await recommendationRepository.findProductFacets(facetIds);

    const withFacets = (product) => ({
      ...product,
      tagIds: tagsByProduct[product.id] || [],
      specs: specsByProduct[product.id] || {},
    });

    const candidates = products.map(withFacets);
    const purchasedProducts = purchasedIds.map((id) => productById.get(id)).filter(Boolean).map(withFacets);

    const similarityRows =
      viewedIds.length > 0
        ? await recommendationRepository.findSimilarToMany(viewedIds.slice(0, 20))
        : [];

    const components = {
      userPreference: this.scoreUserPreference(candidates, profile),
      searchHistory: this.scoreSearchHistory(candidates, keywords),
      purchaseHistory: this.scorePurchaseHistory(candidates, purchasedProducts),
      productSimilarity: this.scoreProductSimilarity(candidates, similarityRows, viewedRank),
      popularity: this.scorePopularity(candidates),
    };

    // Single-component mode for the evaluation: zero out everything else so the
    // weights cannot leak in.
    const effective = strategy
      ? Object.fromEntries(Object.keys(components).map((key) => [key, key === strategy ? components[key] : {}]))
      : components;

    if (strategy && !components[strategy]) {
      throw new AppError(`Unknown strategy "${strategy}"`, 400);
    }

    // Chế độ một thành phần thì trọng số là 1 cho đúng thành phần đó; còn lại
    // dùng bộ trọng số thích ứng theo tín hiệu có thật của chính khách này.
    const weights = strategy ? { [strategy]: 1 } : this.resolveWeights(effective);
    const excludeIds = new Set(purchasedIds);

    let ranked = this.combine(candidates, effective, { excludeIds, weights });

    // A brand-new shopper produces no signal at all; fall back rather than
    // returning an empty rail.
    let usedStrategy = strategy || "hybrid";
    if (ranked.length === 0) {
      ranked = this.combine(candidates, { popularity: components.popularity }, { weights: { popularity: 1 } });
      usedStrategy = "popularity-fallback";
    }

    /**
     * Lấp chỗ trống bằng sản phẩm bán chạy — CHỈ những ô còn thừa.
     *
     * Đây là nửa còn lại của việc hạ `popularity` xuống vai trò dự phòng. Ở v1
     * nó là một số hạng trong tổng nên luôn nhích thứ hạng của mọi sản phẩm; giờ
     * nó không được phép chạm vào thứ tự của những gợi ý có tín hiệu thật, chỉ
     * được điền vào phần đuôi mà tín hiệu cá nhân không với tới.
     *
     * Không có bước này thì việc bỏ popularity khỏi tổng sẽ làm rail ngắn lại
     * với khách ít dữ liệu — đổi precision lấy chỗ trống trên trang.
     */
    if (!strategy && ranked.length < limit) {
      const already = new Set(ranked.map((item) => item.productId));
      const filler = this.combine(candidates, { popularity: components.popularity }, {
        excludeIds: new Set([...excludeIds, ...already]),
        weights: { popularity: 1 },
      });

      ranked = ranked.concat(
        filler.slice(0, limit - ranked.length).map((item) => ({
          ...item,
          reasonCode: REASON_CODES.popularity,
          reasonMetadata: { ...item.reasonMetadata, dominant: "popularity", filler: true },
        })),
      );
    }

    ranked = ranked.slice(0, limit);

    const itemIdByProductId = persist
      ? await this.persist({
          userId,
          sessionId,
          ranked,
          recommendationType: "PERSONALIZED_HOME",
          weights,
          // Ghi lại để `readCachedResult` dựng lại được `strategy` và
          // `personalised` mà không phải đoán từ `weights`.
          strategy: usedStrategy,
        })
      : new Map();

    return {
      items: await this.decorate(ranked, { itemIdByProductId }),
      strategy: usedStrategy,
      algorithmVersion: ALGORITHM_VERSION,
      personalised: usedStrategy !== "popularity-fallback",
      // Trọng số THỰC SỰ đã dùng cho lượt này, không phải bảng hằng số. Với
      // trọng số thích ứng thì hai khách khác nhau nhận hai bộ khác nhau, và
      // ghi lại bảng chung sẽ làm log nói sai về chính phép tính vừa chạy.
      weights,
      cached: false,
    };
  }

  /**
   * Dòng `recommendation_results` còn hạn, dựng lại đúng hình dạng mà đường tính
   * lại trả về — kể cả `itemId` của chính những dòng `recommendation_items` đã lưu.
   *
   * Trả `null` (nghĩa là "tính lại") ở MỌI ca không dựng lại được nguyên vẹn.
   * Một cache sai còn tệ hơn không cache: nó phục vụ một dải khác với dải đã ghi,
   * trong khi `recommendation_items` vẫn khai là đã hiện đúng dải cũ — và outcome
   * báo về sẽ quy kết cho những `itemId` không phải thứ khách thật sự nhìn thấy.
   */
  async readCachedResult({ userId, sessionId, limit }) {
    try {
      const result = await recommendationRepository.findFreshResult({
        userId,
        sessionId,
        recommendationType: "PERSONALIZED_HOME",
      });

      if (!result) {
        return null;
      }

      const context = result.context || {};

      if (!CACHEABLE_STRATEGIES.has(context.strategy)) {
        return null;
      }

      // Công thức đổi thì số đo trước và sau không so được với nhau, nên một dòng
      // của phiên bản trước phải bị bỏ chứ không được dùng lại.
      if (result.algorithmVersion !== ALGORITHM_VERSION) {
        return null;
      }

      const stored = (result.items || []).slice(0, limit);

      /**
       * Dòng hẹp hơn `limit` thì không trả lời được request này.
       *
       * Không lấp thêm cho đủ: phần lấp thêm sẽ không có `itemId` nào, và một dải
       * nửa đo được nửa không làm cột "shown" nói sai về đúng chỗ nó vừa được sửa.
       * Tính lại rồi ghi một dòng rộng hơn — request `limit` nhỏ sau đó vẫn đọc
       * lại được dòng đó vì `findFreshResult` lấy dòng mới nhất.
       */
      if (stored.length < limit) {
        return null;
      }

      /**
       * Mua rồi thì không được gợi ý lại.
       *
       * `excludeIds` đã lọc lúc dòng này sinh ra, nhưng một lượt mua SAU đó thì
       * dòng cũ không biết — và `SATISFIED_TYPES` tồn tại vì gợi ý lại thứ khách
       * vừa mua là kiểu hỏng dễ thấy nhất. Bỏ cả cache thay vì bỏ từng thẻ: bỏ
       * thẻ sẽ làm dải ngắn lại dưới `limit`, còn lượt mua thì vốn hiếm nên tính
       * lại ở đây gần như không bao giờ chạy.
       */
      const purchasedIds = await recommendationRepository.findPurchasedProductIds(userId, {
        since: new Date(Date.now() - RECENCY_WINDOW_DAYS * 86400000),
        behaviorTypes: SATISFIED_TYPES,
      });
      const purchased = new Set(purchasedIds);

      if (stored.some((item) => purchased.has(item.productId))) {
        return null;
      }

      const items = await this.decorate(
        stored.map((item) => ({
          productId: item.productId,
          // DECIMAL(12,6) về từ MySQL dưới dạng chuỗi; đường tính lại trả số, và
          // client so sánh/định dạng giá trị này.
          score: Number(item.score),
          reasonCode: item.reasonCode,
          reasonMetadata: item.reasonMetadata,
        })),
        { itemIdByProductId: new Map(stored.map((item) => [item.productId, item.id])) },
      );

      /**
       * `decorate` đọc sản phẩm theo khoá chính và KHÔNG lọc `status` — nó không
       * cần lọc ở đường tính lại vì `findScorableProducts` chỉ trả ACTIVE. Ở đây
       * thì dòng đã lưu có thể trỏ tới sản phẩm vừa bị ẩn hoặc xoá trong 15 phút
       * vừa qua, nên phải tự kiểm: thiếu thẻ (`decorate` đã bỏ) hoặc còn thẻ mà
       * không còn ACTIVE thì tính lại.
       */
      if (items.length < stored.length || items.some((item) => item.product.status !== "ACTIVE")) {
        return null;
      }

      return {
        items,
        strategy: context.strategy,
        algorithmVersion: result.algorithmVersion,
        personalised: context.strategy !== "popularity-fallback",
        // Đọc lại từ chính dòng đã ghi, không phải tính lại từ bảng hằng số:
        // trọng số thích ứng khiến hai khách chạy bằng hai bộ khác nhau.
        weights: context.weights || {},
        cached: true,
      };
    } catch (error) {
      // Cùng lập luận với `persist`: mất cache không được làm khách mất gợi ý.
      // Tính lại thì chậm hơn, nhưng dải vẫn hiện.
      logger.warn("Failed to read a cached recommendation result", {
        error: logger.serializeError(error),
      });
      return null;
    }
  }

  /**
   * "Related products" for a product page, straight off the similarity matrix.
   *
   * Persisted like the personalised rail whenever we know who is looking, so a
   * click on this rail is measured the same way — the evaluation chapter needs
   * both surfaces, not just the homepage.
   */
  async getSimilarProducts(productId, { limit = DEFAULT_LIMIT, userId = null, sessionId = null, persist = true } = {}) {
    const product = await recommendationRepository.findProductById(productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const rows = await recommendationRepository.findSimilarTo(productId, { limit: limit * 2 });

    // The matrix can be stale relative to the catalogue, so an inactive or
    // deleted product must not surface.
    const activeProducts = await recommendationRepository.findScorableProducts();
    const active = new Set(activeProducts.map((p) => p.id));

    const ranked = rows
      .filter((row) => active.has(row.similarProductId))
      .slice(0, limit)
      .map((row) => ({
        productId: row.similarProductId,
        score: Number(row.score),
        reasonCode: "SIMILAR_TO_THIS",
        reasonMetadata: { sourceProductId: productId, similarityType: row.similarityType },
      }));

    const itemIdByProductId =
      persist && (userId || sessionId)
        ? await this.persist({ userId, sessionId, ranked, recommendationType: "SIMILAR_PRODUCTS" })
        : new Map();

    return {
      items: await this.decorate(ranked, { itemIdByProductId }),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  /**
   * Attach everything a storefront rail needs to render a card, plus the id the
   * client reports outcomes against.
   *
   * One extra query per request, by primary key, over at most `limit` rows. An
   * earlier version reused the already-loaded scoring catalogue to avoid it —
   * but that catalogue carries no image, brand or category name, so the rail had
   * nothing to draw with, and it carried no item id, so
   * `POST /recommendations/items/:itemId/outcome` could never be called. The
   * query buys back both.
   */
  async decorate(ranked, { itemIdByProductId = new Map() } = {}) {
    if (ranked.length === 0) {
      return [];
    }

    const cards = await recommendationRepository.findProductCards(ranked.map((entry) => entry.productId));

    return ranked
      .map((entry, index) => {
        const product = cards.get(entry.productId);
        if (!product) {
          return null;
        }

        const images = product.images || [];
        const primaryImage = images.find((image) => image.isPrimary) || images[0] || null;

        return {
          // Null when the rail was not persisted (anonymous visitors): there is
          // no row to attribute an outcome to, and the client must not invent one.
          itemId: itemIdByProductId.get(entry.productId) || null,
          rankPosition: index + 1,
          score: entry.score,
          reasonCode: entry.reasonCode,
          reasonMetadata: entry.reasonMetadata,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            shortDescription: product.shortDescription,
            basePrice: Number(product.basePrice),
            salePrice: product.salePrice === null ? null : Number(product.salePrice),
            status: product.status,
            stockQuantity: Number(product.stockQuantity) || 0,
            averageRating: Number(product.averageRating) || 0,
            reviewCount: Number(product.reviewCount) || 0,
            isFeatured: Boolean(product.isFeatured),
            imageUrl: primaryImage ? primaryImage.imageUrl : null,
            category: product.category
              ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
              : null,
            brand: product.brand
              ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug }
              : null,
          },
        };
      })
      .filter(Boolean);
  }

  /**
   * Stored so outcomes (click / cart / purchase) can be attributed back to the
   * recommendation that produced them — the raw material of the evaluation.
   *
   * Returns `productId → itemId` so `decorate` can hand each card the id the
   * client will report against.
   */
  async persist({ userId, sessionId, ranked, recommendationType, weights = HYBRID_WEIGHTS, strategy = null }) {
    if (ranked.length === 0) {
      return new Map();
    }

    try {
      const { items } = await recommendationRepository.createResultWithItems(
        {
          userId,
          sessionId,
          recommendationType,
          algorithmVersion: ALGORITHM_VERSION,
          // Trọng số của CHÍNH lượt này. Ghi bảng hằng số vào đây thì mọi dòng
          // `recommendation_results` đều khai cùng một bộ, trong khi trọng số
          // thích ứng khiến hai khách chạy bằng hai bộ khác nhau — và đây là
          // bảng chương Đánh giá đọc.
          //
          // `strategy` ghi cùng chỗ vì `readCachedResult` cần nó để biết dòng này
          // có được dùng lại hay không: một dòng của `?strategy=popularity` là
          // danh sách một thành phần, không phải kết quả của phép ghép.
          context: { weights, strategy },
          expiresAt: new Date(Date.now() + CACHE_MINUTES * 60000),
        },
        ranked.map((entry, index) => ({
          productId: entry.productId,
          rankPosition: index + 1,
          score: entry.score,
          reasonCode: entry.reasonCode,
          reasonMetadata: entry.reasonMetadata,
        })),
      );

      return new Map(items.map((item) => [item.productId, item.id]));
    } catch (error) {
      // Losing the audit trail must not cost the shopper their recommendations.
      // The rail still renders; its cards simply carry no outcome id.
      logger.warn("Failed to persist a recommendation result", { error: logger.serializeError(error) });
      return new Map();
    }
  }

  /** Record that a shown recommendation was acted on. */
  async recordOutcome(itemId, outcome, { userId = null, sessionId = null } = {}) {
    const item = await recommendationRepository.findItemById(itemId);

    if (!item) {
      throw new AppError("Recommendation item not found", 404);
    }

    /**
     * Chỉ chủ của dải mới được báo kết quả trên nó.
     *
     * Bản trước viết `item.recommendation?.userId && userId && ...`, và **mệnh đề
     * `&& userId` làm cả chốt chặn vô hiệu với người gọi vô danh**: `userId` là
     * `null` thì điều kiện luôn false, nên bất kỳ ai có một `itemId` cũng ghi được
     * `clickedAt`/`addedToCartAt`/`purchasedAt` lên dải của người khác. Đó là ghi
     * đè trực tiếp vào CTR/conversion mà chương Đánh giá đọc.
     *
     * Dùng đúng mẫu mà `aiService.explainRecommendation` đã dùng: đã đăng nhập thì
     * xét theo `userId`, khách vãng lai xét theo `sessionId` của dải. 404 chứ không
     * 403, để endpoint không thành công cụ dò `itemId`.
     */
    const owner = item.recommendation;
    const ownedByUser = Boolean(userId) && owner?.userId === userId;
    const ownedBySession = !owner?.userId && Boolean(sessionId) && owner?.sessionId === sessionId;

    if (!ownedByUser && !ownedBySession) {
      throw new AppError("Recommendation item not found", 404);
    }

    const field = { CLICK: "clickedAt", ADD_TO_CART: "addedToCartAt", PURCHASE: "purchasedAt" }[outcome];

    if (!field) {
      throw new AppError("Unknown outcome", 400);
    }

    // First occurrence wins: overwriting would lose the time-to-action.
    if (item[field]) {
      return { itemId, outcome, alreadyRecorded: true };
    }

    await recommendationRepository.updateItem(item, { [field]: new Date() });

    return { itemId, outcome, alreadyRecorded: false };
  }

  // ── Offline similarity matrix ─────────────────────────────────────────────

  /**
   * Recomputes the content-based similarity matrix.
   *
   * O(n^2) over the catalogue, which is why it is a batch job and not part of a
   * request. Only the top `perProduct` neighbours above `minScore` are stored —
   * keeping the full matrix would be mostly noise and would grow quadratically.
   */
  async rebuildSimilarityMatrix({ perProduct = 12, minScore = 0.15 } = {}) {
    const products = await recommendationRepository.findScorableProducts();

    if (products.length < 2) {
      return { products: products.length, pairs: 0 };
    }

    const { tagsByProduct, specsByProduct } = await recommendationRepository.findProductFacets(
      products.map((p) => p.id),
    );

    const enriched = products.map((product) => ({
      ...product,
      tagIds: tagsByProduct[product.id] || [],
      specs: specsByProduct[product.id] || {},
    }));

    const rows = [];

    enriched.forEach((source) => {
      const neighbours = [];

      enriched.forEach((other) => {
        if (other.id === source.id) {
          return;
        }
        const { score } = computeContentSimilarity(source, other);
        if (score >= minScore) {
          neighbours.push({ id: other.id, score });
        }
      });

      neighbours
        .sort((a, b) => b.score - a.score)
        .slice(0, perProduct)
        .forEach((neighbour) => {
          rows.push({
            productId: source.id,
            similarProductId: neighbour.id,
            similarityType: "CONTENT",
            score: neighbour.score,
            calculatedAt: new Date(),
          });
        });
    });

    const stored = await recommendationRepository.replaceSimilarities(rows, { similarityType: "CONTENT" });

    return { products: products.length, pairs: stored, perProduct, minScore };
  }

  /**
   * Tỉ lệ theo TỪNG loại rail, cộng một dòng tổng.
   *
   * Dòng tổng giữ lại để tương thích với người gọi cũ, nhưng nó **không phải** con
   * số để trích vào chương Đánh giá: nó gộp dải cá nhân hoá với dải "sản phẩm
   * tương tự" vào một mẫu số. Số cần trích nằm ở `byType.PERSONALIZED_HOME`.
   */
  async getOutcomeStats(options = {}) {
    const rows = await recommendationRepository.getOutcomeStats(options);

    const summarise = (row) => {
      const shown = Number(row.shown) || 0;
      const clicked = Number(row.clicked) || 0;
      const addedToCart = Number(row.addedToCart) || 0;
      const purchased = Number(row.purchased) || 0;
      const rate = (value) => (shown === 0 ? 0 : Math.round((value / shown) * 10000) / 10000);

      return {
        shown,
        clicked,
        addedToCart,
        purchased,
        clickThroughRate: rate(clicked),
        cartRate: rate(addedToCart),
        conversionRate: rate(purchased),
      };
    };

    const byType = Object.fromEntries(rows.map((row) => [row.recommendationType, summarise(row)]));

    const combined = rows.reduce(
      (acc, row) => ({
        shown: acc.shown + (Number(row.shown) || 0),
        clicked: acc.clicked + (Number(row.clicked) || 0),
        addedToCart: acc.addedToCart + (Number(row.addedToCart) || 0),
        purchased: acc.purchased + (Number(row.purchased) || 0),
      }),
      { shown: 0, clicked: 0, addedToCart: 0, purchased: 0 },
    );

    return { byType, ...summarise(combined) };
  }
}

module.exports = new RecommendationService();

/**
 * Bảng trọng số, lộ ra để harness đo lường quét thử.
 *
 * `src/seed/simulate/measure.js --sweep` ghi đè các khoá của object này rồi đo
 * lại, nên chọn được bộ trọng số bằng SỐ thay vì bằng cảm tính. Không nơi nào
 * trong đường chạy thật được sửa nó — đây là cửa cho công cụ đo, không phải một
 * điểm cấu hình lúc chạy.
 */
module.exports.HYBRID_WEIGHTS = HYBRID_WEIGHTS;
module.exports.PERSONAL_KEYS = PERSONAL_KEYS;
module.exports.POPULARITY_BLEND = POPULARITY_BLEND;
