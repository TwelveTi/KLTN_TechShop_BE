require("dotenv").config();

const { Op } = require("sequelize");
const db = require("../../models");
const behaviorService = require("../../services/behaviorService");
const recommendationService = require("../../services/recommendationService");
const { STRATEGIES } = require("../../middlewares/recommendationValidation");
const groundTruth = require("./ground-truth.json");

/**
 * Đo precision@10 của bộ gợi ý trên dữ liệu mô phỏng.
 *
 *   node src/seed/simulate/measure.js
 *   node src/seed/simulate/measure.js --k=10 --skip-prepare
 *
 * Cách đo: với mỗi khách mô phỏng, lấy top-K gợi ý rồi đếm bao nhiêu cái nằm
 * trong `targetProductIds` của persona — tập sản phẩm mà bộ gợi ý **chưa bao giờ
 * được cho biết**. `?strategy=` chạy từng thành phần một mình, nên bảng kết quả
 * so được hybrid với chính các thành phần của nó.
 *
 * Mốc so sánh là NGẪU NHIÊN, tính theo đúng công thức: kỳ vọng của việc bốc K
 * sản phẩm bất kỳ trúng tập mục tiêu. Một thành phần không vượt được mốc này thì
 * nó không đóng góp gì, dù con số tuyệt đối trông có vẻ ổn.
 *
 * PHẢI chạy lại sau mỗi lần đổi catalogue: ground truth lưu UUID cứng, và số đo
 * trên một catalogue khác là số của một hệ thống khác.
 */

const parseArgs = (argv) => {
  const args = { k: 10, prepare: true, sweep: false };

  argv.slice(2).forEach((raw) => {
    if (raw === "--skip-prepare") {
      args.prepare = false;
      return;
    }
    if (raw === "--sweep") {
      args.sweep = true;
      return;
    }
    const match = raw.match(/^--k=(\d+)$/);
    if (match) args.k = Number(match[1]);
  });

  return args;
};

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

const precisionFor = async (userId, targetIds, { strategy, k }) => {
  const result = await recommendationService.getForUser({
    userId,
    sessionId: null,
    limit: k,
    strategy,
  });

  const items = result.items || [];
  const hits = items.filter((item) => targetIds.has(item.product?.id ?? item.productId)).length;

  return { hits, shown: items.length };
};

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
  }

  const activeCount = await db.Product.count({ where: { status: "ACTIVE" } });

  // ── Chế độ quét trọng số ──────────────────────────────────────────────────
  if (args.sweep) {
    const { HYBRID_WEIGHTS } = require("../../services/recommendationService");
    const original = { ...HYBRID_WEIGHTS };
    const slots = matched.length * args.k;

    console.log(`=== Quét trọng số · precision@${args.k} · ${matched.length} khách ===\n`);
    console.log(`${"bộ trọng số".padEnd(34)}  trúng/ô     p@K`);
    console.log("-".repeat(60));

    const results = [];
    for (const candidate of CANDIDATES) {
      // Ghi đè TẠI CHỖ: `HYBRID_WEIGHTS` là một object hằng, service đọc thẳng
      // từ nó nên gán lại từng khoá là đủ để đổi hành vi mà không phải nạp lại
      // module cho mỗi ứng viên.
      Object.assign(HYBRID_WEIGHTS, original, candidate.w);

      let hits = 0;
      for (const user of matched) {
        const targetIds = new Set(truthByUser.get(user.id).truth.targetProductIds);
        const result = await precisionFor(user.id, targetIds, { strategy: null, k: args.k });
        hits += result.hits;
      }

      const precision = (hits / slots) * 100;
      results.push({ name: candidate.name, hits, precision });
      console.log(`${candidate.name.padEnd(34)}  ${String(hits).padStart(3)}/${slots}   ${precision.toFixed(1).padStart(5)}%`);
    }

    Object.assign(HYBRID_WEIGHTS, original);

    const best = results.reduce((a, b) => (b.precision > a.precision ? b : a));
    const base = results[0];
    console.log("-".repeat(60));
    console.log(`\nTốt nhất: ${best.name.trim()} — ${best.precision.toFixed(1)}%`);
    console.log(`So với v1 gốc: ${(best.precision - base.precision >= 0 ? "+" : "") + (best.precision - base.precision).toFixed(1)} điểm`);
    console.log(
      "\nCẢNH BÁO: bộ trọng số này được chọn TRÊN CHÍNH tập vừa đo. Phải kiểm lại\n" +
        "trên một lượt `simulate` với seed khác trước khi tin — xem README 6.5.",
    );

    await db.sequelize.close();
    return;
  }

  const rows = [];
  for (const strategy of [null, ...STRATEGIES]) {
    let hits = 0;
    let shown = 0;

    for (const user of matched) {
      const truth = truthByUser.get(user.id);
      const targetIds = new Set(truth.truth.targetProductIds);
      const result = await precisionFor(user.id, targetIds, { strategy, k: args.k });
      hits += result.hits;
      shown += result.shown;
    }

    const slots = matched.length * args.k;

    rows.push({
      name: strategy === null ? "HYBRID (35/25/20/10/10)" : strategy,
      hits,
      shown,
      // Precision trên số ô THỰC SỰ được lấp.
      precision: shown === 0 ? 0 : (hits / shown) * 100,
      // Độ phủ: lấp được bao nhiêu phần của `khách × K`.
      //
      // Cột này bắt buộc phải có. `searchHistory` chỉ trả kết quả cho khách đã
      // từng tìm kiếm, nên precision của nó tính trên một mẫu nhỏ hơn hẳn, và
      // đọc thẳng con số đó cạnh hybrid là so hai thứ khác cỡ mẫu. Một thành
      // phần precision cao mà phủ 40% không thay thế được một thành phần phủ
      // 100%.
      coverage: (shown / slots) * 100,
      // Precision quy về TOÀN BỘ ô — ô không lấp được tính là trượt. Đây mới là
      // con số so sánh trực tiếp được giữa các thành phần.
      filled: (hits / slots) * 100,
    });
  }

  // Mốc ngẫu nhiên: bốc K sản phẩm bất kỳ thì kỳ vọng trúng bao nhiêu phần trăm.
  // Trung bình trên các persona vì mỗi persona có số mục tiêu khác nhau.
  const randomBaseline =
    (matched.reduce((sum, user) => {
      const targets = truthByUser.get(user.id).truth.targetProductIds.length;
      return sum + targets / activeCount;
    }, 0) /
      matched.length) *
    100;

  const label = (name) => name.padEnd(26);
  console.log(`=== precision@${args.k} · ${matched.length} khách · ${activeCount} sản phẩm ACTIVE ===\n`);
  console.log(`${label("thành phần")}   p@K   độ phủ   quy về mọi ô   (trúng/hiện)`);
  console.log("-".repeat(74));

  rows
    .slice()
    .sort((a, b) => b.filled - a.filled)
    .forEach((row) => {
      console.log(
        `${label(row.name)} ${row.precision.toFixed(1).padStart(5)}%  ` +
          `${row.coverage.toFixed(0).padStart(4)}%  ` +
          `${row.filled.toFixed(1).padStart(11)}%   ` +
          `(${row.hits}/${row.shown})`,
      );
    });

  console.log("-".repeat(74));
  console.log(`${label("ngẫu nhiên (kỳ vọng)")} ${randomBaseline.toFixed(1).padStart(5)}%`);

  const hybrid = rows.find((row) => row.name.startsWith("HYBRID"));
  // So bằng cột `filled`: đó là cột duy nhất cùng mẫu số cho mọi thành phần.
  const bestPart = rows
    .filter((row) => !row.name.startsWith("HYBRID"))
    .reduce((best, row) => (row.filled > best.filled ? row : best));

  console.log("");
  console.log(
    `Hybrid so với thành phần tốt nhất (${bestPart.name}, quy về mọi ô): ` +
      `${(hybrid.filled - bestPart.filled >= 0 ? "+" : "") + (hybrid.filled - bestPart.filled).toFixed(1)} điểm`,
  );
  console.log(
    `Hybrid so với ngẫu nhiên: ${(((hybrid.precision - randomBaseline) / randomBaseline) * 100).toFixed(1)}% tương đối`,
  );

  await db.sequelize.close();
})().catch(async (error) => {
  console.error("LỖI:", error.message);
  console.error(error.stack.split("\n").slice(1, 4).join("\n"));
  await db.sequelize.close();
  process.exit(1);
});
