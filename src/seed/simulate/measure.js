require("dotenv").config();

const { Op } = require("sequelize");
const db = require("../../models");
const behaviorService = require("../../services/behaviorService");
const recommendationService = require("../../services/recommendationService");
const recommendationRepository = require("../../repositories/recommendationRepository");
const { STRATEGIES } = require("../../middlewares/recommendationValidation");
const counters = require("./counters");
const groundTruth = require("./ground-truth.json");

/**
 * Đo chất lượng bộ gợi ý trên dữ liệu mô phỏng.
 *
 *   node src/seed/simulate/measure.js
 *   node src/seed/simulate/measure.js --k=3 --skip-prepare
 *   node src/seed/simulate/measure.js --sweep --k=3
 *
 * Cách đo: với mỗi khách mô phỏng, lấy top-K gợi ý rồi đếm bao nhiêu cái nằm
 * trong `truth.targets` của persona — tập sản phẩm mà bộ gợi ý **chưa bao giờ
 * được cho biết**. `?strategy=` chạy từng thành phần một mình, nên bảng kết quả
 * so được hybrid với chính các thành phần của nó.
 *
 * PHẢI chạy lại sau mỗi lần đổi catalogue: ground truth lưu UUID cứng, và số đo
 * trên một catalogue khác là số của một hệ thống khác.
 *
 * ── VÌ SAO BẢNG NÀY CÓ CỘT "TRẦN" (2026-09-08) ───────────────────────────────
 *
 * `precision@K` một mình **nói sai** về hệ thống này, và sai theo hướng dìm nó
 * xuống. Hai lý do độc lập, cả hai đều là tính chất của phép đo chứ không phải
 * của thuật toán:
 *
 *  1. **Đáp án tự loại chính nó.** `getForUser` loại sản phẩm khách đã mua khỏi
 *     tập ứng viên (`excludeIds`) — đúng, không ai muốn được gợi ý lại thứ vừa
 *     mua. Nhưng `truth.targets` CHÍNH LÀ thứ persona xem rồi mua. Đo được
 *     trên seed 42: 42.1% target đã bị mua nên không bao giờ có thể xuất hiện,
 *     và 13/60 khách bị mua sạch target — với họ mọi thuật toán đều được 0 điểm.
 *  2. **Tập mục tiêu nhỏ hơn K.** Target trung bình ~3 sản phẩm; ở K=10 thì
 *     ngay cả một recommender hoàn hảo cũng chỉ lấp được 3/10 ô.
 *
 * Cộng lại: trần của một recommender HOÀN HẢO ở K=10 chỉ là 16.2%, nên đọc
 * "hybrid 16.2%" như một điểm số trên thang 100 là đọc sai. Vì vậy bảng in thêm
 * ba cột, và **cột `% trần` mới là cột nói lên chất lượng thuật toán**:
 *
 *   recall@K  — trúng bao nhiêu phần của những target CÒN VỚI TỚI ĐƯỢC
 *   % trần    — đạt bao nhiêu phần trăm của thứ tốt nhất có thể đạt
 *   TRẦN      — một dòng riêng, để mọi cột trên có mốc so
 *
 * Mốc ngẫu nhiên cũng được sửa theo. Bản trước tính `target / tổng SP ACTIVE`,
 * tức tử số bị chặn bởi `excludeIds` mà mẫu số thì không — so hai thứ khác điều
 * kiện. Giờ nó là kỳ vọng của việc bốc K sản phẩm từ ĐÚNG tập ứng viên mà thuật
 * toán được chọn (đã trừ hàng đã mua), trúng vào tập target còn với tới được.
 * Trên seed 42 con số đúng là 8.1%, không phải 12.7%.
 */

/**
 * Hai hằng số này PHẢI khớp với `recommendationService`.
 *
 * Trần chỉ đúng nếu tập bị loại ở đây giống hệt tập mà service loại. Lệch một
 * chút là trần sai, và trần sai còn nguy hiểm hơn không có trần — nó cho một
 * con số trông như đã hiệu chỉnh.
 */
const RECENCY_WINDOW_DAYS = 90;
const SATISFIED_TYPES = ["PURCHASE"];

const parseArgs = (argv) => {
  const args = { k: 10, prepare: true, sweep: false, loo: false, popsweep: false, profileCheck: false };

  argv.slice(2).forEach((raw) => {
    if (raw === "--skip-prepare") {
      args.prepare = false;
      return;
    }
    if (raw === "--sweep") {
      args.sweep = true;
      return;
    }
    if (raw === "--loo") {
      args.loo = true;
      return;
    }
    if (raw === "--popsweep") {
      args.popsweep = true;
      return;
    }
    if (raw === "--profile-check") {
      args.profileCheck = true;
      return;
    }
    const match = raw.match(/^--k=(\d+)$/);
    if (match) args.k = Number(match[1]);
  });

  return args;
};

const DAY_MS = 86400000;
const startOfUtcDay = (value) => new Date(Math.floor(new Date(value).getTime() / DAY_MS) * DAY_MS);

/**
 * Các bộ trọng số đem ra so, theo thứ tự `userPreference / searchHistory /
 * purchaseHistory / productSimilarity`.
 *
 * Không phải quét mù. Bảng ở README 6.4 nói ba điều, và mỗi ứng viên dưới đây
 * kiểm chứng một suy luận rút ra từ đó:
 *   - `purchaseHistory` đạt đúng mức ngẫu nhiên → thử hạ mạnh và thử bỏ hẳn;
 *   - `searchHistory` mạnh nhất khi có → thử cho nó dẫn đầu;
 *   - `productSimilarity` khá hơn `purchaseHistory` → thử nâng nó lên thế chỗ.
 *
 * `popularity` không có trong bảng: từ v2 nó không còn là số hạng trong tổng.
 */
const CANDIDATES = [
  { name: "v1 gốc            35/25/20/10", w: { userPreference: 0.35, searchHistory: 0.25, purchaseHistory: 0.2, productSimilarity: 0.1 } },
  { name: "A hạ purchase     40/30/05/25", w: { userPreference: 0.4, searchHistory: 0.3, purchaseHistory: 0.05, productSimilarity: 0.25 } },
  { name: "B search dẫn đầu  30/40/05/25", w: { userPreference: 0.3, searchHistory: 0.4, purchaseHistory: 0.05, productSimilarity: 0.25 } },
  { name: "C bỏ purchase     40/35/00/25", w: { userPreference: 0.4, searchHistory: 0.35, purchaseHistory: 0, productSimilarity: 0.25 } },
  { name: "D preference nặng 50/25/05/20", w: { userPreference: 0.5, searchHistory: 0.25, purchaseHistory: 0.05, productSimilarity: 0.2 } },
  { name: "E similarity lên  30/30/05/35", w: { userPreference: 0.3, searchHistory: 0.3, purchaseHistory: 0.05, productSimilarity: 0.35 } },
  { name: "F đều, bỏ purchase 33/33/00/34", w: { userPreference: 0.33, searchHistory: 0.33, purchaseHistory: 0, productSimilarity: 0.34 } },
];

/**
 * Dựng lại những gì bộ gợi ý đọc nhưng `simulate` không sinh ra.
 *
 * `simulate` chỉ ghi hành vi thô. `UserPreferenceProfile` là bản gộp có trọng số
 * của hành vi đó, và ma trận `ProductSimilarity` là bảng tính offline giữa các
 * sản phẩm — thiếu một trong hai thì thành phần tương ứng trả về rỗng và bảng
 * kết quả sẽ đổ tội nhầm cho thuật toán.
 */
const prepare = async (userIds) => {
  process.stdout.write("  Dựng UserPreferenceProfile... ");
  for (const userId of userIds) {
    await behaviorService.recomputeProfile(userId);
  }
  console.log(`${userIds.length} hồ sơ`);

  process.stdout.write("  Dựng ma trận ProductSimilarity... ");
  const result = await recommendationService.rebuildSimilarityMatrix({});
  console.log(`${result.pairs ?? result.rows ?? "?"} cặp`);
};

/**
 * Với mỗi khách: đáp án nào còn với tới được, và thuật toán được chọn trong tập
 * nào. Tính MỘT LẦN rồi dùng lại cho mọi K và mọi strategy — nó không phụ thuộc
 * vào thuật toán, chỉ phụ thuộc vào dữ liệu.
 *
 * `purchased` phải dựng đúng cách `getForUser` dựng `excludeIds`: cùng cửa sổ,
 * cùng hàm repository, cùng phép lọc theo `SATISFIED_TYPES`. Gọi thẳng
 * `findRecentBehaviors` thay vì viết một truy vấn khác cho gọn — `limit: 300`
 * của nó cũng là một phần của hành vi cần khớp.
 */
const buildContexts = async (matched, truthByUser, activeIds) => {
  const since = new Date(Date.now() - RECENCY_WINDOW_DAYS * 86400000);
  const contexts = [];

  for (const user of matched) {
    const behaviors = await recommendationRepository.findRecentBehaviors(user.id, { since });
    const purchased = new Set(
      behaviors.filter((row) => SATISFIED_TYPES.includes(row.behaviorType)).map((row) => row.productId),
    );

    const persona = truthByUser.get(user.id);
    const { primary = [], secondary = [] } = persona.truth.targets || {};

    /**
     * Đáp án CÓ HẠNG. `rel` là mức liên quan, và nó là thứ NDCG chấm điểm:
     *
     *   rel = 2  gu chính — thứ hệ thống phải xếp lên đầu
     *   rel = 1  gu phụ   — được thưởng khi để lọt vào, nhưng ít hơn
     *   rel = 0  còn lại
     *
     * Với gain `2^rel − 1` thì một sản phẩm hạng chính đáng giá gấp 3 lần một
     * sản phẩm hạng phụ (7 so với 1 sau khi trừ, tức 75/25) — xấp xỉ tỉ lệ
     * "80/20" đã chốt. Ví dụ để hiểu vì sao phải có hạng: khách cho Dell vào giỏ
     * nhưng mấy hôm nay click xem ASUS. Bỏ Dell khỏi gợi ý là sai; bỏ hẳn ASUS
     * cũng sai. Chỉ một thang có hạng nói được điều đó.
     */
    const relById = new Map();
    secondary.forEach((id) => relById.set(id, 1));
    // Hạng chính ghi SAU để nó thắng nếu một id tình cờ có ở cả hai danh sách.
    primary.forEach((id) => relById.set(id, 2));

    const reachableWith = (rel) =>
      [...relById.entries()]
        .filter(([id, value]) => value === rel && activeIds.has(id) && !purchased.has(id))
        .map(([id]) => id);

    // Một target đã bị ẩn/xoá khỏi catalogue cũng không với tới được, y như một
    // target đã mua — `findScorableProducts` chỉ trả về ACTIVE.
    const reachable = reachableWith(2);
    const reachableSecondary = reachableWith(1);

    let pool = 0;
    activeIds.forEach((id) => {
      if (!purchased.has(id)) pool += 1;
    });

    contexts.push({
      userId: user.id,
      type: persona.type,
      // `targets` giữ nghĩa NGHIÊM KHẮC: chỉ hạng chính, và là TOÀN BỘ hạng chính
      // (kể cả phần không với tới được — việc trừ ra là việc của `reachable`).
      // Mọi cột cũ (p@K, recall, % trần) tính trên tập này, nên chúng vẫn so được
      // với số của bước A. Đây cũng là cột "nghiêm khắc" đã chốt.
      targets: new Set(primary),
      relById,
      purchased,
      reachable,
      reachableSecondary,
      pool,
    });
  }

  return contexts;
};

/**
 * DCG của một danh sách, và DCG lý tưởng của chính khách đó.
 *
 * `idealDcg` chỉ xếp những target CÒN VỚI TỚI ĐƯỢC — target đã mua bị
 * `excludeIds` loại khỏi ứng viên nên không recommender nào trả về được, và tính
 * chúng vào mẫu số là phạt thuật toán vì một quyết định thiết kế cố ý. Nhờ vậy
 * `NDCG = DCG / idealDcg` đã bao gồm sẵn khái niệm "trần" của bước A, nhưng có
 * thêm nhận thức về VỊ TRÍ.
 */
const gain = (rel) => 2 ** rel - 1;

const dcgOf = (items, relById) =>
  items.reduce((sum, item, index) => {
    const rel = relById.get(item.product?.id ?? item.productId) || 0;
    return sum + gain(rel) / Math.log2(index + 2);
  }, 0);

const idealDcgOf = (context, k) => {
  const rels = context.reachable
    .map(() => 2)
    .concat(context.reachableSecondary.map(() => 1))
    .slice(0, k);

  return rels.reduce((sum, rel, index) => sum + gain(rel) / Math.log2(index + 2), 0);
};

/**
 * `persist: false` là BẮT BUỘC, vì hai lý do độc lập:
 *
 *  1. **Cache.** `getForUser` đọc lại dòng `recommendation_results` còn hạn 15
 *     phút. Chế độ `--sweep` chạy 7 bộ trọng số liên tiếp trên cùng một khách,
 *     nên nếu không tắt thì bộ thứ hai trở đi đọc lại kết quả của bộ thứ nhất và
 *     cả bảng quét chỉ là một con số nhân bảy. `persist: false` tắt cả ghi lẫn
 *     đọc — xem `getForUser`.
 *  2. **Mẫu số CTR.** Một lượt đo sinh `khách × strategy × K` dòng
 *     `recommendation_items`, không lượt nào có người thật nhìn thấy để mà bấm.
 *     Trộn chúng vào `GET /admin/recommendations/stats` là tự dìm CTR của chính
 *     chương Đánh giá bằng công cụ đo của chương đó.
 */
const measureOne = async (context, { strategy, k }) => {
  const result = await recommendationService.getForUser({
    userId: context.userId,
    sessionId: null,
    limit: k,
    strategy,
    persist: false,
  });

  /**
   * Một thành phần không trả gì thì phải tính là KHÔNG LẤP ĐƯỢC Ô, chứ không
   * phải tính điểm của popularity vào tên nó.
   *
   * `getForUser` có nhánh dự phòng: `ranked.length === 0` thì nó tính lại bằng
   * `popularity` và đặt `strategy = "popularity-fallback"`. Nhánh đó KHÔNG bị
   * chặn bởi `strategy`, nên ở chế độ đo một thành phần, khách nào không có tín
   * hiệu của thành phần đó vẫn nhận về đủ K sản phẩm — của popularity.
   *
   * Bỏ qua ở đây, không sửa `getForUser`: với người dùng thật thì trả về danh
   * sách phổ biến còn hơn trả rail rỗng, nên hành vi API giữ nguyên. Chỉ phép
   * ĐẾM là sai, và nó được sửa ở đây.
   */
  if (strategy && result.strategy === "popularity-fallback") {
    return { hits: 0, shown: 0, dcg: 0, scored: false };
  }

  const items = result.items || [];
  const hits = items.filter((item) => context.targets.has(item.product?.id ?? item.productId)).length;

  return { hits, shown: items.length, dcg: dcgOf(items, context.relById), scored: true };
};

/**
 * Baseline tầm thường: `WHERE category_id = <danh mục ưa thích nhất>`.
 *
 * Dòng quan trọng nhất của cả bảng, và nó tồn tại vì một câu hỏi phản biện: *"bộ
 * gợi ý năm thành phần có hơn được một câu lọc theo danh mục không?"* Không đo
 * thì không trả lời được, mà không trả lời được thì cả chương Đánh giá lung lay.
 *
 * Cố ý KHÔNG lấp đủ K từ danh mục khác: một baseline tầm thường phải thật sự tầm
 * thường. Nó lấp được bao nhiêu ô thì cột "độ phủ" nói, và cột "quy về mọi ô"
 * quy nó về cùng mẫu số với các dòng khác.
 *
 * Chịu đúng ràng buộc của thuật toán thật (bỏ hàng đã mua) và xếp hạng tất định
 * theo `id` như `combine` làm, để chênh lệch đọc được là chênh lệch thuật toán
 * chứ không phải chênh lệch điều kiện.
 */
const measureCategoryBaseline = async (context, { k, activeProducts, profile = undefined }) => {
  // `profile` truyền vào ở chế độ `--loo`: hồ sơ đã lưu là hồ sơ của HÔM NAY, gộp
  // từ cả những hành vi sau mốc cắt. Baseline cũng phải chịu đúng điều kiện của
  // thuật toán thật, nếu không thì nó thi với lợi thế nhìn trước.
  const resolved = profile === undefined ? await recommendationRepository.findProfile(context.userId) : profile;
  const topCategoryId = resolved?.preferredCategories?.[0]?.id ?? null;

  if (!topCategoryId) {
    return { hits: 0, shown: 0, dcg: 0, scored: false };
  }

  const picked = activeProducts
    .filter((product) => product.categoryId === topCategoryId && !context.purchased.has(product.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, k);

  return {
    hits: picked.filter((product) => context.targets.has(product.id)).length,
    shown: picked.length,
    dcg: dcgOf(picked.map((product) => ({ productId: product.id })), context.relById),
    scored: true,
  };
};

const pct = (value) => `${(value * 100).toFixed(1)}%`;

/**
 * ── Đo tách theo thời gian: leave-one-out (2026-09-08) ───────────────────────
 *
 * Bảng `precision@K` ở trên có một khiếm khuyết không sửa được bằng cách thêm
 * cột: **đáp án của nó CHÍNH LÀ tham số đã sinh ra dữ liệu**. `truth` của persona
 * là (danh mục, hãng, khoảng giá); `recomputeProfile` khôi phục đúng ba trường
 * đó; `scoreUserPreference` chấm điểm cũng bằng đúng ba trường đó. Phép đo vì vậy
 * không hỏi "bộ gợi ý có hoạt động không" mà hỏi "ta có nghịch đảo được mô hình
 * sinh của chính ta không" — và §6.3 đã tự trả lời: khôi phục đúng danh mục 97.9%.
 *
 * Giao thức này hỏi một câu khác, và là câu mà một hệ gợi ý thật phải trả lời:
 * **món khách sắp mua có nằm trong K gợi ý không.**
 *
 *   E      = lượt chuyển đổi CUỐI CÙNG của khách (ưu tiên PURCHASE, không có thì
 *            ADD_TO_CART)
 *   mốc cắt = đầu ngày UTC chứa E
 *   giấu   = mọi hành vi và từ khoá từ mốc cắt trở đi
 *   đáp án = đúng MỘT sản phẩm của E
 *
 * Cắt theo NGÀY chứ không theo đúng mili-giây của E, và đây là chi tiết quyết
 * định: bộ sinh đặt cả một phiên vào trong một ngày, và một lượt PURCHASE luôn có
 * ADD_TO_CART của cùng sản phẩm chỉ vài chục giây trước. Cắt ngay tại E thì mô
 * hình vẫn nhìn thấy lượt cho vào giỏ của đúng món cần đoán — tầm dự báo 30 giây,
 * không nói lên điều gì. Cắt theo ngày cho tầm dự báo tới một ngày và không còn
 * rò rỉ trong cùng phiên.
 *
 * Ba nguồn rò rỉ đã bịt, và cả ba đều bắt buộc:
 *
 *  1. **Hồ sơ sở thích.** Bản đã lưu được gộp từ cả hành vi sau mốc cắt. Đường
 *     `asOf` của `getForUser` dựng lại nó tại chỗ với `persist: false`.
 *  2. **Hành vi và từ khoá.** `findRecentBehaviors` / `findRecentKeywords` nhận
 *     `before`, và cửa sổ 90 ngày trượt theo mốc cắt chứ không neo vào hôm nay.
 *  3. **Bộ đếm phổ biến.** `soldCount` mang trong nó CHÍNH lượt mua đang được
 *     giấu — sản phẩm cần đoán tự cộng điểm popularity cho mình. Trước khi đo,
 *     bộ đếm được tính lại chỉ từ phần huấn luyện của từng khách; đo xong thì
 *     tính lại từ toàn bộ sự kiện để DB về đúng trạng thái cũ.
 *
 * Ma trận `ProductSimilarity` KHÔNG cần chặn: nó thuần nội dung (danh mục, hãng,
 * tag, giá, thông số), không đọc hành vi của ai cả.
 *
 * Chỉ số: HR@K (có trúng không), MRR@K (trúng ở hạng nào), NDCG@K. Với đúng một
 * đáp án nhị phân thì NDCG@K = 1/log2(hạng+1). MRR là chỉ số nhạy VỊ TRÍ, nên nó
 * phân biệt được "xếp hạng 1" với "xếp hạng 9" ngay cả khi HR đã bão hoà — đó là
 * lý do nó có mặt ở đây, xem README 6.4.1.
 */
const buildLooCases = async (matched, truthByUser, activeIds) => {
  const cases = [];
  const skipped = { noConversion: 0, noValidConversion: 0 };
  let backedOff = 0;

  for (const user of matched) {
    const events = await db.UserBehavior.findAll({
      where: { userId: user.id, productId: { [Op.ne]: null } },
      attributes: ["behaviorType", "productId", "occurredAt"],
      order: [["occurredAt", "ASC"]],
      raw: true,
    });

    /**
     * Ứng viên để giấu: lượt chuyển đổi MỚI NHẤT **trên một sản phẩm chưa từng
     * mua trong cửa sổ**, không phải lượt mới nhất tuyệt đối.
     *
     * Bản trước lấy đúng lượt cuối rồi bỏ cả khách nếu món đó đã mua từ trước —
     * `excludeIds` sẽ loại nó khỏi ứng viên nên trượt là chắc chắn, mà đó lại là
     * hành vi ĐÚNG của sản phẩm. Cái giá: 39/120 khách bị bỏ, và nặng nhất là
     * `EXPLORING` (còn 3/12) vì nhóm đó mua lặp lại trên gu cam kết — đúng nhóm
     * phân biệt tốt nhất lại vắng mặt ở giao thức mạnh nhất.
     *
     * Lùi về lượt chuyển đổi hợp lệ gần nhất vẫn là leave-one-out: đáp án vẫn là
     * một lượt mua thật, vẫn nằm SAU toàn bộ lịch sử mà mô hình được đọc. Chỉ
     * khác là chọn ca hợp lệ thay vì bỏ khách.
     *
     * Ưu tiên `PURCHASE` trước `ADD_TO_CART` (tín hiệu mạnh hơn), trong mỗi loại
     * thì mới nhất trước.
     */
    const desc = (type) =>
      events
        .filter((row) => row.behaviorType === type)
        .slice()
        .reverse();
    const candidates = [...desc("PURCHASE"), ...desc("ADD_TO_CART")];

    if (candidates.length === 0) {
      skipped.noConversion += 1;
      continue;
    }

    let chosen = null;
    let attempt = 0;

    for (const candidate of candidates) {
      attempt += 1;

      // Không còn trong tập ứng viên thì không thuật toán nào trả về được.
      if (!activeIds.has(candidate.productId)) {
        continue;
      }

      const cutoff = startOfUtcDay(candidate.occurredAt);
      const history = events.filter((row) => new Date(row.occurredAt) < cutoff);

      // Không có gì để dựng hồ sơ — đo ở đây là đo đường khách mới, không phải
      // đo khả năng dự đoán.
      if (history.length === 0) {
        continue;
      }

      // Cùng cửa sổ với `getForUser`: nó chỉ loại những gì đã mua trong 90 ngày
      // TRƯỚC MỐC CẮT. Lọc rộng hơn ở đây sẽ bỏ đi những ca mà thuật toán thật
      // vẫn trả về được — tức là tự thu hẹp mẫu vì một lý do không có thật.
      const windowStart = new Date(cutoff.getTime() - RECENCY_WINDOW_DAYS * 86400000);
      const purchasedBefore = new Set(
        history
          .filter((row) => SATISFIED_TYPES.includes(row.behaviorType) && new Date(row.occurredAt) >= windowStart)
          .map((row) => row.productId),
      );

      if (purchasedBefore.has(candidate.productId)) {
        continue;
      }

      let pool = 0;
      activeIds.forEach((id) => {
        if (!purchasedBefore.has(id)) pool += 1;
      });

      chosen = { candidate, cutoff, pool };
      if (attempt > 1) {
        backedOff += 1;
      }
      break;
    }

    if (!chosen) {
      skipped.noValidConversion += 1;
      continue;
    }

    cases.push({
      userId: user.id,
      type: truthByUser.get(user.id).type,
      cutoff: chosen.cutoff,
      targetId: chosen.candidate.productId,
      heldType: chosen.candidate.behaviorType,
      pool: chosen.pool,
      // Hồ sơ tại mốc cắt, dùng cho baseline chỉ-lọc-danh-mục. Đúng bản mà
      // `getForUser({ asOf })` sẽ tự dựng cho các thành phần còn lại.
      profile: await behaviorService.recomputeProfile(user.id, { before: chosen.cutoff, persist: false }),
    });
  }

  return { cases, skipped, backedOff };
};

const rankOfTarget = (items, targetId) => {
  const index = items.findIndex((item) => (item.product?.id ?? item.productId) === targetId);
  return index === -1 ? null : index + 1;
};

const looScores = (rank) =>
  rank === null ? { hit: 0, rr: 0, dcg: 0 } : { hit: 1, rr: 1 / rank, dcg: 1 / Math.log2(rank + 1) };

(async () => {
  const args = parseArgs(process.argv);

  const simUsers = await db.User.findAll({
    where: { email: { [Op.like]: "%@sim.techshop.dev" } },
    attributes: ["id", "email"],
    raw: true,
  });

  if (simUsers.length === 0) {
    console.log("Không có khách mô phỏng nào. Chạy `npm run simulate` trước.");
    await db.sequelize.close();
    return;
  }

  // Ground truth khoá theo userId, nên nó chỉ khớp với ĐÚNG lượt simulate đã
  // sinh ra nó. Lệch nghĩa là file cũ hơn dữ liệu trong DB.
  const truthByUser = new Map(groundTruth.personas.map((p) => [p.userId, p]));
  const matched = simUsers.filter((user) => truthByUser.has(user.id));

  console.log(`\nGround truth: seed ${groundTruth.seed}, ${groundTruth.users} khách, sinh lúc ${groundTruth.generatedAt.slice(0, 19)}`);
  console.log(`Khớp với DB : ${matched.length}/${simUsers.length} khách\n`);

  if (matched.length === 0) {
    console.log("KHÔNG khớp khách nào — ground-truth.json cũ hơn dữ liệu trong DB.");
    console.log("Chạy `npm run simulate` để sinh lại rồi đo tiếp.");
    await db.sequelize.close();
    return;
  }

  if (args.prepare) {
    await prepare(matched.map((u) => u.id));
    console.log("");
  } else {
    /**
     * Chốt chặn cho `--skip-prepare`.
     *
     * `simulate` xoá khách mô phỏng và **xoá cả hồ sơ của họ**, nên một lượt
     * `--skip-prepare` ngay sau `simulate` chạy trên bảng hồ sơ rỗng. Khi đó
     * `findProfile` trả `null`, `scoreUserPreference` trả rỗng, và bảng in ra
     * `userPreference 0.0% (0/0)` cùng một dòng HYBRID bị hụt hẳn thành phần nặng
     * nhất — trông y như một phát hiện về thuật toán.
     *
     * Đã tự sập bẫy này một lần khi chốt số cho README. Thà dừng còn hơn in ra một
     * bảng sai mà đọc thì thấy hợp lý.
     */
    const profileCount = await db.UserPreferenceProfile.count({
      where: { userId: matched.map((u) => u.id) },
    });

    if (profileCount < matched.length) {
      console.log(
        `DỪNG: chỉ có ${profileCount}/${matched.length} khách có UserPreferenceProfile.\n` +
          `\`--skip-prepare\` chỉ dùng được khi một lượt đo TRƯỚC ĐÓ đã dựng hồ sơ trên\n` +
          `đúng bộ dữ liệu này. \`simulate\` xoá hồ sơ cùng với khách, nên sau khi sinh\n` +
          `lại dữ liệu thì phải chạy một lượt CÓ prepare. Bỏ \`--skip-prepare\` và chạy lại.`,
      );
      await db.sequelize.close();
      return;
    }
  }

  // Cùng nguồn với `getForUser`, không phải `Product.count()`: trần và mốc ngẫu
  // nhiên phải nói về đúng tập ứng viên mà thuật toán được chọn trong đó.
  const activeProducts = await recommendationRepository.findScorableProducts();
  const activeIds = new Set(activeProducts.map((p) => p.id));

  const contexts = await buildContexts(matched, truthByUser, activeIds);

  const slots = matched.length * args.k;
  const ceiling = contexts.reduce((sum, c) => sum + Math.min(c.reachable.length, args.k), 0);
  const reachableTotal = contexts.reduce((sum, c) => sum + c.reachable.length, 0);
  const randomHits = contexts.reduce(
    (sum, c) => sum + (c.pool > 0 ? (args.k * c.reachable.length) / c.pool : 0),
    0,
  );
  const blockedUsers = contexts.filter((c) => c.reachable.length === 0).length;

  /**
   * ── Kiểm `UserPreferenceProfile` khôi phục được gì (README 6.3) ─────────────
   *
   * Dựng hồ sơ CHỈ từ sự kiện, rồi đối chiếu `truth`. Đây là phép đo đứng TRƯỚC
   * mọi phép đo gợi ý: nếu hồ sơ không khôi phục được gu thì không thành phần nào
   * đọc nó có thể đúng, và bảng ở 6.4 sẽ đổ tội nhầm cho thuật toán.
   *
   * Với persona hai pha thì nó còn nói một điều nữa, và là điều đáng giá nhất: hồ
   * sơ khôi phục ra gu CHÍNH hay gu PHỤ? `recomputeProfile` cộng
   * `total × SIGNAL_WEIGHTS` trên cửa sổ 90 ngày **phẳng, không có số hạng thời
   * gian**, nên với `SHIFTING_INTENT` (gu chính là gu MỚI) nó được dự đoán là sẽ
   * bám gu cũ. Cột "khôi phục ra gu phụ" đo trực tiếp khiếm khuyết đó.
   */
  if (args.profileCheck) {
    const rows = [];

    for (const user of matched) {
      const persona = truthByUser.get(user.id);
      const truth = persona.truth;
      const profile = await behaviorService.recomputeProfile(user.id, { persist: false });

      const topCategory = profile.preferredCategories?.[0]?.id ?? null;
      const topBrand = profile.preferredBrands?.[0]?.id ?? null;
      const average = profile.averagePrice === null ? null : Number(profile.averagePrice);

      rows.push({
        type: persona.type,
        // `BRAND_LOYAL` có `categoryId = null` (gu xuyên danh mục), nên nó không
        // tham gia phép đếm danh mục — đếm nó vào là đếm một câu hỏi không có đáp án.
        categoryAsked: Boolean(truth.categoryId),
        categoryHit: Boolean(truth.categoryId) && topCategory === truth.categoryId,
        categorySecondary:
          Boolean(truth.secondaryTaste?.categoryId) && topCategory === truth.secondaryTaste.categoryId,
        brandAsked: Boolean(truth.brandId),
        brandHit: Boolean(truth.brandId) && topBrand === truth.brandId,
        budgetAsked: average !== null,
        budgetHit: average !== null && average >= truth.minPrice && average <= truth.maxPrice,
        twoPhase: truth.shiftDay !== null,
      });
    }

    const tally = (list, asked, hit) => {
      const pool = list.filter((r) => r[asked]);
      const ok = pool.filter((r) => r[hit]).length;
      return { ok, n: pool.length, pct: pool.length > 0 ? ok / pool.length : null };
    };
    const show = (t) => (t.n === 0 ? "     —      " : `${String(t.ok).padStart(3)}/${String(t.n).padEnd(3)} ${pct(t.pct).padStart(6)}`);

    console.log(`=== UserPreferenceProfile khôi phục được gì · ${matched.length} khách ===\n`);
    console.log(`${"nhóm".padEnd(18)}  đúng danh mục     đúng hãng      ngân sách trong dải`);
    console.log("-".repeat(76));
    console.log(
      `${"TẤT CẢ".padEnd(18)}  ${show(tally(rows, "categoryAsked", "categoryHit"))}  ` +
        `${show(tally(rows, "brandAsked", "brandHit"))}  ${show(tally(rows, "budgetAsked", "budgetHit"))}`,
    );
    console.log("-".repeat(76));

    [...new Set(rows.map((r) => r.type))].sort().forEach((type) => {
      const list = rows.filter((r) => r.type === type);
      console.log(
        `${type.padEnd(18)}  ${show(tally(list, "categoryAsked", "categoryHit"))}  ` +
          `${show(tally(list, "brandAsked", "brandHit"))}  ${show(tally(list, "budgetAsked", "budgetHit"))}`,
      );
    });

    const twoPhase = rows.filter((r) => r.twoPhase && r.categoryAsked);
    const toPrimary = twoPhase.filter((r) => r.categoryHit).length;
    const toSecondary = twoPhase.filter((r) => r.categorySecondary).length;

    console.log(`\n=== Persona hai pha: hồ sơ bám gu nào? (${twoPhase.length} khách) ===\n`);
    console.log(`  khôi phục ra gu CHÍNH : ${toPrimary}/${twoPhase.length}  ${pct(toPrimary / twoPhase.length)}`);
    console.log(`  khôi phục ra gu PHỤ   : ${toSecondary}/${twoPhase.length}  ${pct(toSecondary / twoPhase.length)}`);
    console.log(`  ra danh mục thứ ba    : ${twoPhase.length - toPrimary - toSecondary}/${twoPhase.length}`);
    ["EXPLORING", "SHIFTING_INTENT"].forEach((type) => {
      const list = twoPhase.filter((r) => r.type === type);
      if (list.length === 0) return;
      console.log(
        `    ${type.padEnd(16)} chính ${list.filter((r) => r.categoryHit).length}/${list.length} · ` +
          `phụ ${list.filter((r) => r.categorySecondary).length}/${list.length}`,
      );
    });
    console.log(
      `\n"Ngân sách trong dải" = \`averagePrice\` của hồ sơ nằm trong [minPrice, maxPrice]\n` +
        `của \`truth\`. \`BRAND_LOYAL\` không tham gia cột danh mục vì gu của nó xuyên danh mục.`,
    );

    await db.sequelize.close();
    return;
  }

  /**
   * ── Chế độ kiểm lại `hybrid-v2`: popularity nên là số hạng hay dự phòng? ────
   *
   * `hybrid-v2` loại `popularity` khỏi tổng và chỉ dùng nó khi khách không có tín
   * hiệu cá nhân nào. Bằng chứng cho quyết định đó (README 6.4.1: "popularity
   * 9.2% so với 13.5% của ngẫu nhiên") **không hợp lệ**, vì hai lỗi cộng lại:
   * `simulate` không cập nhật `soldCount`/`viewCount` nên popularity đang được
   * chấm trên số viết tay trong `products.data.js`, và mốc ngẫu nhiên thì tính
   * trên toàn catalogue trong khi tử số bị `excludeIds` chặn.
   *
   * Sau khi sửa cả hai, số nói điều khác: popularity là thành phần **mạnh nhất**
   * cho `RESEARCHER` dưới LOO (HR@10 72.2% trên seed 42, 77.8% trên seed 7) — hợp
   * lý, vì nhóm xem trải rộng thì món mua kế tiếp của họ thường là hàng bán chạy.
   *
   * Chế độ này quét `POPULARITY_BLEND.weight` trên **cả hai giao thức trong cùng
   * một lượt**, vì đó đúng là chỗ hai giao thức bất đồng: precision hỏi "khôi phục
   * gu đã khai", LOO hỏi "đoán món mua kế tiếp". Một trọng số chỉ đáng tin nếu nó
   * không làm tệ đi ở giao thức còn lại — và phải giữ dấu trên seed thứ hai.
   */
  if (args.popsweep) {
    const { POPULARITY_BLEND } = require("../../services/recommendationService");
    const originalShare = POPULARITY_BLEND.weight;
    const SHARES = [0, 0.05, 0.1, 0.15, 0.25];
    const LOO_K = 10;

    const { cases } = await buildLooCases(matched, truthByUser, activeIds);
    const cutoffByUser = new Map(cases.map((c) => [c.userId, c.cutoff]));
    const simUserIds = matched.map((u) => u.id);
    const productIds = activeProducts.map((p) => p.id);

    const idealByUser = new Map(contexts.map((c) => [c.userId, idealDcgOf(c, args.k)]));

    console.log(`=== Quét trọng số popularity · precision@${args.k} + LOO@${LOO_K} ===\n`);
    console.log(`${matched.length} khách · ${cases.length} ca LOO · ${activeIds.size} sản phẩm ACTIVE\n`);
    console.log(`${"share".padStart(6)}  ${"NDCG@" + args.k}  ${"p@" + args.k}   ${"HR@" + LOO_K}   MRR@${LOO_K}   ghi chú`);
    console.log("-".repeat(64));

    const results = [];

    try {
      for (const share of SHARES) {
        POPULARITY_BLEND.weight = share;

        // ── Giao thức 1: precision có hạng (bộ đếm ĐẦY ĐỦ) ──
        await counters.recomputeFromEvents(simUserIds, productIds);

        let ndcgSum = 0;
        let ndcgCount = 0;
        let hits = 0;

        for (const context of contexts) {
          const result = await measureOne(context, { strategy: null, k: args.k });
          hits += result.hits;

          const ideal = idealByUser.get(context.userId);
          if (ideal > 0) {
            ndcgSum += result.dcg / ideal;
            ndcgCount += 1;
          }
        }

        // ── Giao thức 2: LOO (bộ đếm CHỈ phần huấn luyện) ──
        await counters.recomputeFromEvents(simUserIds, productIds, { cutoffByUser });

        let hit = 0;
        let rr = 0;

        for (const testCase of cases) {
          const result = await recommendationService.getForUser({
            userId: testCase.userId,
            sessionId: null,
            limit: LOO_K,
            persist: false,
            asOf: testCase.cutoff,
          });
          const scores = looScores(rankOfTarget(result.items || [], testCase.targetId));
          hit += scores.hit;
          rr += scores.rr;
        }

        const row = {
          share,
          ndcg: ndcgCount > 0 ? ndcgSum / ndcgCount : 0,
          precision: hits / slots,
          hr: hit / cases.length,
          mrr: rr / cases.length,
        };
        results.push(row);

        console.log(
          `${share === 0 ? "v2 (0)" : share.toFixed(2)}`.padStart(6) +
            `  ${row.ndcg.toFixed(3).padStart(6)}  ${pct(row.precision).padStart(5)}  ` +
            `${pct(row.hr).padStart(6)}   ${row.mrr.toFixed(3).padStart(6)}   ` +
            `${share === 0 ? "hybrid-v2 hiện tại" : share === 0.1 ? "= hành vi v1" : ""}`,
        );
      }
    } finally {
      POPULARITY_BLEND.weight = originalShare;
      const restored = await counters.recomputeFromEvents(simUserIds, productIds);
      console.log(`\nBộ đếm phổ biến đã trả về đầy đủ: ${restored.views} lượt xem · ${restored.sold} đơn vị bán.`);
    }

    const base = results[0];
    console.log("-".repeat(64));
    console.log(`\nSo với hybrid-v2 (share = 0):`);
    results.slice(1).forEach((row) => {
      const d = (a, b, digits = 3) => `${a - b >= 0 ? "+" : ""}${(a - b).toFixed(digits)}`;
      console.log(
        `  share ${row.share.toFixed(2)}  NDCG ${d(row.ndcg, base.ndcg)}  ` +
          `p@${args.k} ${d(row.precision * 100, base.precision * 100, 1)} điểm  ` +
          `HR ${d(row.hr * 100, base.hr * 100, 1)} điểm  MRR ${d(row.mrr, base.mrr)}`,
      );
    });
    console.log(
      `\nMột trọng số chỉ đáng tin khi nó KHÔNG làm tệ đi ở giao thức còn lại, và\n` +
        `khi dấu giữ nguyên trên seed thứ hai. Chạy lại với \`npm run simulate -- --seed=7\`.`,
    );

    await db.sequelize.close();
    return;
  }

  // ── Chế độ leave-one-out theo thời gian ───────────────────────────────────
  if (args.loo) {
    const { cases, skipped, backedOff } = await buildLooCases(matched, truthByUser, activeIds);

    console.log(`=== Leave-one-out theo thời gian · K=${args.k} · ${activeIds.size} sản phẩm ACTIVE ===\n`);
    console.log(`Dùng được: ${cases.length}/${matched.length} khách`);
    console.log(
      `  bỏ: ${skipped.noConversion} không có lượt chuyển đổi nào · ` +
        `${skipped.noValidConversion} không có lượt nào hợp lệ (món nào cũng đã mua trước, hoặc không có lịch sử)`,
    );
    console.log(
      `  ${backedOff} khách phải lùi về một lượt chuyển đổi cũ hơn lượt cuối ` +
        `(lượt cuối là mua lại món đã mua)\n`,
    );

    if (cases.length === 0) {
      console.log("Không có ca nào đo được.");
      await db.sequelize.close();
      return;
    }

    const cutoffByUser = new Map(cases.map((c) => [c.userId, c.cutoff]));
    const simUserIds = matched.map((u) => u.id);
    const productIds = activeProducts.map((p) => p.id);

    // Bịt rò rỉ số 3: popularity chỉ được biết phần huấn luyện.
    const trained = await counters.recomputeFromEvents(simUserIds, productIds, { cutoffByUser });
    console.log(
      `Bộ đếm phổ biến tính lại chỉ từ phần huấn luyện: bỏ ${trained.excluded} sự kiện,\n` +
        `còn ${trained.views} lượt xem · ${trained.sold} đơn vị bán.\n`,
    );

    try {
      const rows = [];

      const looArchetypes = [...new Set(cases.map((c) => c.type))].sort();

      for (const strategy of [null, ...STRATEGIES]) {
        let hit = 0;
        let rr = 0;
        let dcg = 0;
        let shown = 0;
        const perType = new Map(looArchetypes.map((type) => [type, { hit: 0, n: 0 }]));

        for (const testCase of cases) {
          const result = await recommendationService.getForUser({
            userId: testCase.userId,
            sessionId: null,
            limit: args.k,
            strategy,
            persist: false,
            asOf: testCase.cutoff,
          });

          const bucket = perType.get(testCase.type);
          bucket.n += 1;

          if (strategy && result.strategy === "popularity-fallback") {
            continue;
          }

          shown += 1;
          const scores = looScores(rankOfTarget(result.items || [], testCase.targetId));
          hit += scores.hit;
          rr += scores.rr;
          dcg += scores.dcg;
          bucket.hit += scores.hit;
        }

        rows.push({ name: strategy === null ? "HYBRID (hybrid-v2)" : strategy, hit, rr, dcg, shown, perType });
      }

      let baseHit = 0;
      let baseRr = 0;
      let baseDcg = 0;
      for (const testCase of cases) {
        const picked = activeProducts
          .filter((p) => p.categoryId === (testCase.profile?.preferredCategories?.[0]?.id ?? null))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .slice(0, args.k);
        const index = picked.findIndex((p) => p.id === testCase.targetId);
        const scores = looScores(index === -1 ? null : index + 1);
        baseHit += scores.hit;
        baseRr += scores.rr;
        baseDcg += scores.dcg;
      }
      rows.push({ name: "baseline: chỉ lọc danh mục", hit: baseHit, rr: baseRr, dcg: baseDcg, shown: cases.length });

      // Mốc ngẫu nhiên: xếp hạng bừa `pool` sản phẩm rồi lấy K đầu.
      const random = cases.reduce(
        (acc, c) => {
          const p = c.pool;
          for (let r = 1; r <= args.k && r <= p; r += 1) {
            acc.rr += 1 / (r * p);
            acc.dcg += 1 / (Math.log2(r + 1) * p);
          }
          acc.hit += Math.min(args.k, p) / p;
          return acc;
        },
        { hit: 0, rr: 0, dcg: 0 },
      );

      const n = cases.length;
      const label = (name) => name.padEnd(27);
      const header = `${label("thành phần")}${`HR@${args.k}`.padStart(7)} ${`MRR@${args.k}`.padStart(8)} ${`NDCG@${args.k}`.padStart(9)} ${"độ phủ".padStart(8)}   (trúng/đo)`;

      console.log(header);
      console.log("-".repeat(header.length));

      rows
        .slice()
        .sort((a, b) => b.hit / n - a.hit / n || b.rr - a.rr)
        .forEach((row) => {
          console.log(
            `${label(row.name)}${pct(row.hit / n).padStart(7)} ` +
              `${(row.rr / n).toFixed(3).padStart(8)} ` +
              `${(row.dcg / n).toFixed(3).padStart(9)} ` +
              `${pct(row.shown / n).padStart(8)}   (${row.hit}/${n})`,
          );
        });

      console.log("-".repeat(header.length));
      console.log(
        `${label("ngẫu nhiên (kỳ vọng)")}${pct(random.hit / n).padStart(7)} ` +
          `${(random.rr / n).toFixed(3).padStart(8)} ` +
          `${(random.dcg / n).toFixed(3).padStart(9)}`,
      );

      const hybrid = rows.find((row) => row.name.startsWith("HYBRID"));
      const bestPart = rows
        .filter((row) => !row.name.startsWith("HYBRID"))
        .reduce((best, row) => (row.hit > best.hit ? row : best));

      // Bảng tách theo archetype: xem thành phần nào cứu được nhóm nào.
      const withTypes = rows.filter((row) => row.perType);
      const shortName = (name) =>
        ({
          "HYBRID (hybrid-v2)": "HYBRID",
          userPreference: "userPref",
          searchHistory: "search",
          purchaseHistory: "purchase",
          productSimilarity: "prodSim",
          popularity: "popular",
        })[name] || name;

      console.log(`\n=== HR@${args.k} tách theo archetype ===\n`);
      console.log(`${"archetype".padEnd(18)}${"n".padStart(4)}  ` + withTypes.map((r) => shortName(r.name).padStart(9)).join(" "));
      console.log("-".repeat(22 + withTypes.length * 10));
      looArchetypes.forEach((type) => {
        const n = withTypes[0].perType.get(type).n;
        console.log(
          `${type.padEnd(18)}${String(n).padStart(4)}  ` +
            withTypes
              .map((r) => {
                const bucket = r.perType.get(type);
                return (bucket.n > 0 ? pct(bucket.hit / bucket.n) : "—").padStart(9);
              })
              .join(" "),
        );
      });

      console.log("");
      console.log(`Hybrid so với ngẫu nhiên : HR ${(((hybrid.hit - random.hit) / random.hit) * 100).toFixed(1)}% tương đối`);
      console.log(
        `Hybrid so với ${bestPart.name.padEnd(14)}: HR ${(hybrid.hit - bestPart.hit >= 0 ? "+" : "") + (((hybrid.hit - bestPart.hit) / n) * 100).toFixed(1)} điểm` +
          ` · MRR ${(hybrid.rr - bestPart.rr >= 0 ? "+" : "") + ((hybrid.rr - bestPart.rr) / n).toFixed(3)}`,
      );
      console.log(
        `\nĐáp án là MỘT sản phẩm khách thật sự mua/thêm giỏ SAU mốc cắt, không phải\n` +
          `tham số đã sinh ra dữ liệu — nên bảng này không mắc lỗi vòng khép kín của\n` +
          `bảng precision. MRR nhạy vị trí, dùng nó khi HR bão hoà.`,
      );
    } finally {
      // Trả bộ đếm về trạng thái đầy đủ dù đo có lỗi giữa chừng: để nguyên bộ đếm
      // "chỉ phần huấn luyện" thì mọi lượt đo sau đó chạy trên một catalogue khác.
      const restored = await counters.recomputeFromEvents(simUserIds, productIds);
      console.log(`\nBộ đếm phổ biến đã trả về đầy đủ: ${restored.views} lượt xem · ${restored.sold} đơn vị bán.`);
    }

    await db.sequelize.close();
    return;
  }

  // ── Chế độ quét trọng số ──────────────────────────────────────────────────
  if (args.sweep) {
    const { HYBRID_WEIGHTS } = require("../../services/recommendationService");
    const original = { ...HYBRID_WEIGHTS };

    console.log(`=== Quét trọng số · K=${args.k} · ${matched.length} khách ===\n`);
    console.log(`Trần của recommender hoàn hảo: ${ceiling}/${slots} = ${pct(ceiling / slots)}\n`);
    console.log(`${"bộ trọng số".padEnd(34)}  trúng/ô     p@K   % trần`);
    console.log("-".repeat(66));

    const results = [];
    for (const candidate of CANDIDATES) {
      // Ghi đè TẠI CHỖ: `HYBRID_WEIGHTS` là một object hằng, service đọc thẳng
      // từ nó nên gán lại từng khoá là đủ để đổi hành vi mà không phải nạp lại
      // module cho mỗi ứng viên.
      Object.assign(HYBRID_WEIGHTS, original, candidate.w);

      let hits = 0;
      for (const context of contexts) {
        const result = await measureOne(context, { strategy: null, k: args.k });
        hits += result.hits;
      }

      const precision = hits / slots;
      results.push({ name: candidate.name, hits, precision });
      console.log(
        `${candidate.name.padEnd(34)}  ${String(hits).padStart(3)}/${slots}   ${pct(precision).padStart(6)}  ` +
          `${(ceiling > 0 ? pct(hits / ceiling) : "—").padStart(7)}`,
      );
    }

    Object.assign(HYBRID_WEIGHTS, original);

    const best = results.reduce((a, b) => (b.precision > a.precision ? b : a));
    const base = results[0];
    console.log("-".repeat(66));
    console.log(`\nTốt nhất: ${best.name.trim()} — ${pct(best.precision)}`);
    console.log(
      `So với v1 gốc: ${(best.precision - base.precision >= 0 ? "+" : "") + ((best.precision - base.precision) * 100).toFixed(1)} điểm`,
    );

    // Nếu mọi ứng viên đều sát trần thì phép quét không nói gì về trọng số cả —
    // nó chỉ nói rằng thước đo đã hết chỗ để phân biệt. Cảnh báo này quan trọng
    // hơn con số "tốt nhất" ngay phía trên nó.
    const spread = best.precision - Math.min(...results.map((r) => r.precision));
    if (ceiling > 0 && best.hits / ceiling > 0.9) {
      console.log(
        `\nCẢNH BÁO: bộ tốt nhất đã đạt ${pct(best.hits / ceiling)} của trần, và cả bảng chỉ giãn\n` +
          `${(spread * 100).toFixed(1)} điểm. Ở mức này các bộ trọng số KHÔNG phân biệt được nhau —\n` +
          `chênh lệch đọc được là nhiễu, không phải cải thiện. Xem README 6.4.1.`,
      );
    }

    console.log(
      "\nCẢNH BÁO: bộ trọng số này được chọn TRÊN CHÍNH tập vừa đo. Phải kiểm lại\n" +
        "trên một lượt `simulate` với seed khác trước khi tin — xem README 6.5.",
    );

    await db.sequelize.close();
    return;
  }

  // ── Bảng chính ────────────────────────────────────────────────────────────
  //
  // `ndcgUsers` là những khách có ít nhất một target còn với tới được. Khách có
  // `idealDcg === 0` bị loại khỏi TRUNG BÌNH NDCG, không phải tính là 0 điểm:
  // chia cho 0 thì không có nghĩa, và tính là 0 là phạt thuật toán vì một ca nó
  // không thể thắng. Cùng lập luận với cột "% trần".
  const idealByUser = new Map(contexts.map((c) => [c.userId, idealDcgOf(c, args.k)]));
  const ndcgUsers = contexts.filter((c) => idealByUser.get(c.userId) > 0);

  const archetypes = [...new Set(contexts.map((c) => c.type))].sort();
  const rows = [];

  for (const strategy of [null, ...STRATEGIES, "categoryBaseline"]) {
    let hits = 0;
    let shown = 0;
    let ndcgSum = 0;
    let ndcgCount = 0;
    const perType = new Map(archetypes.map((type) => [type, { ndcg: 0, n: 0 }]));

    for (const context of contexts) {
      const result =
        strategy === "categoryBaseline"
          ? await measureCategoryBaseline(context, { k: args.k, activeProducts })
          : await measureOne(context, { strategy, k: args.k });

      hits += result.hits;
      shown += result.shown;

      const ideal = idealByUser.get(context.userId);
      if (ideal > 0) {
        const ndcg = result.dcg / ideal;
        ndcgSum += ndcg;
        ndcgCount += 1;
        const bucket = perType.get(context.type);
        bucket.ndcg += ndcg;
        bucket.n += 1;
      }
    }

    rows.push({
      name:
        strategy === null
          ? "HYBRID (hybrid-v2)"
          : strategy === "categoryBaseline"
            ? "baseline: chỉ lọc danh mục"
            : strategy,
      baseline: strategy === "categoryBaseline",
      hits,
      shown,
      ndcg: ndcgCount > 0 ? ndcgSum / ndcgCount : 0,
      perType,
    });
  }

  const label = (name) => name.padEnd(27);
  const header =
    `${label("thành phần")}` +
    `${"NDCG".padStart(6)} ` +
    `${"p@K".padStart(6)} ` +
    `${"độ phủ".padStart(7)} ` +
    `${"mọi ô".padStart(8)} ` +
    `${"recall".padStart(8)} ` +
    `${"% trần".padStart(8)}   (trúng/hiện)`;

  console.log(`=== K=${args.k} · ${matched.length} khách · ${activeIds.size} sản phẩm ACTIVE ===\n`);
  console.log(header);
  console.log("-".repeat(header.length));

  const sorted = rows.slice().sort((a, b) => b.ndcg - a.ndcg);

  sorted.forEach((row) => {
    console.log(
      `${label(row.name)}` +
        `${row.ndcg.toFixed(3).padStart(6)} ` +
        `${pct(row.shown === 0 ? 0 : row.hits / row.shown).padStart(6)} ` +
        `${pct(row.shown / slots).padStart(7)} ` +
        `${pct(row.hits / slots).padStart(8)} ` +
        `${(reachableTotal > 0 ? pct(row.hits / reachableTotal) : "—").padStart(8)} ` +
        `${(ceiling > 0 ? pct(row.hits / ceiling) : "—").padStart(8)}   (${row.hits}/${row.shown})`,
    );
  });

  console.log("-".repeat(header.length));
  console.log(
    `${label("TRẦN (hoàn hảo)")}` +
      `${"1.000".padStart(6)} ` +
      `${pct(ceiling / slots).padStart(6)} ` +
      `${"—".padStart(7)} ` +
      `${pct(ceiling / slots).padStart(8)} ` +
      `${pct(reachableTotal > 0 ? ceiling / reachableTotal : 0).padStart(8)} ` +
      `${"100.0%".padStart(8)}   (${ceiling}/${slots})`,
  );
  console.log(
    `${label("ngẫu nhiên (kỳ vọng)")}` +
      `${"—".padStart(6)} ` +
      `${pct(randomHits / slots).padStart(6)} ` +
      `${"—".padStart(7)} ` +
      `${pct(randomHits / slots).padStart(8)}`,
  );

  /**
   * Bảng tách theo archetype — bắt buộc phải có.
   *
   * Toàn bộ luận điểm của roster mới là "các khách khác nhau cần các thành phần
   * khác nhau", và một con số tổng xoá sạch chính điều đó. Đây là bảng nói được
   * `RESEARCHER` có phải chỉ `searchHistory` với tới được không, và `EXPLORING`
   * với `SHIFTING_INTENT` có tách được hai kiểu hệ thống ra không.
   */
  const shortName = (name) =>
    ({
      "HYBRID (hybrid-v2)": "HYBRID",
      "baseline: chỉ lọc danh mục": "catBase",
      userPreference: "userPref",
      searchHistory: "search",
      purchaseHistory: "purchase",
      productSimilarity: "prodSim",
      popularity: "popular",
    })[name] || name;

  const columns = sorted.map((row) => ({ key: shortName(row.name), perType: row.perType }));

  console.log(`\n=== NDCG@${args.k} tách theo archetype ===\n`);
  console.log(
    `${"archetype".padEnd(18)}${"n".padStart(4)}  ` + columns.map((c) => c.key.padStart(9)).join(" "),
  );
  console.log("-".repeat(22 + columns.length * 10));

  archetypes.forEach((type) => {
    const n = columns[0].perType.get(type).n;
    console.log(
      `${type.padEnd(18)}${String(n).padStart(4)}  ` +
        columns
          .map((c) => {
            const bucket = c.perType.get(type);
            return (bucket.n > 0 ? (bucket.ndcg / bucket.n).toFixed(3) : "—").padStart(9);
          })
          .join(" "),
    );
  });

  const hybrid = rows.find((row) => row.name.startsWith("HYBRID"));
  const baseline = rows.find((row) => row.baseline);
  // So bằng số ô trúng: đó là mẫu số chung duy nhất cho mọi dòng.
  const bestPart = rows
    .filter((row) => !row.name.startsWith("HYBRID") && !row.baseline)
    .reduce((best, row) => (row.hits > best.hits ? row : best));

  const gap = (a, b) => `${a - b >= 0 ? "+" : ""}${(((a - b) / slots) * 100).toFixed(1)} điểm`;

  console.log("");
  console.log(`NDCG@${args.k} tính trên ${ndcgUsers.length}/${contexts.length} khách có target còn với tới được`);
  console.log(`Hybrid đạt ${ceiling > 0 ? pct(hybrid.hits / ceiling) : "—"} của trần lý thuyết  (${hybrid.hits}/${ceiling})`);
  console.log(
    `Hybrid so với thành phần tốt nhất (${bestPart.name}): ${gap(hybrid.hits, bestPart.hits)} · ` +
      `NDCG ${(hybrid.ndcg - bestPart.ndcg >= 0 ? "+" : "") + (hybrid.ndcg - bestPart.ndcg).toFixed(3)}`,
  );
  console.log(
    `Hybrid so với baseline chỉ lọc danh mục: ${gap(hybrid.hits, baseline.hits)} · ` +
      `NDCG ${(hybrid.ndcg - baseline.ndcg >= 0 ? "+" : "") + (hybrid.ndcg - baseline.ndcg).toFixed(3)}`,
  );
  console.log(
    `Hybrid so với ngẫu nhiên: ${randomHits > 0 ? (((hybrid.hits - randomHits) / randomHits) * 100).toFixed(1) : "—"}% tương đối`,
  );

  console.log(
    `\nNDCG dùng gain \`2^rel − 1\` với rel=2 cho gu chính và rel=1 cho gu phụ (tỉ lệ\n` +
      `75/25), chuẩn hoá theo DCG lý tưởng của CHÍNH khách đó — nên nó đã bao gồm sẵn\n` +
      `khái niệm "trần", cộng thêm nhận thức về vị trí. Các cột p@K / recall / % trần\n` +
      `chỉ tính gu CHÍNH: đó là cột nghiêm khắc để đối chiếu, phòng khi thang có hạng\n` +
      `nới tay quá. Trần thấp hơn 100% vì ${blockedUsers}/${matched.length} khách đã mua hết target của mình.`,
  );

  await db.sequelize.close();
})().catch(async (error) => {
  console.error("LỖI:", error.message);
  console.error(error.stack.split("\n").slice(1, 4).join("\n"));
  await db.sequelize.close();
  process.exit(1);
});
