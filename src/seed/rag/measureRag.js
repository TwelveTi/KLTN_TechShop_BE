require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../../models");
const ragService = require("../../services/ragService");
const { questions, outOfCorpus } = require("./golden");

/**
 * Đo chất lượng bộ truy hồi RAG trên bộ câu hỏi vàng.
 *
 *   node src/seed/rag/measureRag.js
 *   node src/seed/rag/measureRag.js --policy-only
 *   node src/seed/rag/measureRag.js --sweep
 *   node src/seed/rag/measureRag.js --refresh
 *
 * ── VÌ SAO BẢNG NÀY CÓ HAI BASELINE, KHÔNG PHẢI MỘT ──────────────────────────
 *
 * Câu hỏi cần trả lời không phải "bộ truy hồi có chạy không" mà "embedding có
 * đáng công so với khớp từ khoá không". Một baseline yếu làm câu trả lời đó vô
 * nghĩa, nên ở đây có hai mức:
 *
 *   LIKE  đếm số từ khoá của câu hỏi xuất hiện trong chunk — đúng thứ làm được
 *         bằng một câu SQL, và là thứ sẽ bị hỏi "sao không dùng cho rẻ"
 *   BM25  xếp hạng từ khoá đúng chuẩn, có idf và chuẩn hoá độ dài. Đây mới là
 *         đối thủ thật; hơn LIKE mà thua BM25 thì embedding chưa chứng minh
 *         được gì
 *
 * Ba nhóm câu tách riêng vì chúng trả lời ba câu hỏi khác nhau. NUMERIC dùng
 * đúng từ của văn bản nên khớp từ khoá được lợi; SEMANTIC cố ý tránh từ của văn
 * bản. Nếu embedding chỉ thắng ở mức trung bình mà thua ở NUMERIC thì kết luận
 * đúng là "định tuyến theo loại câu hỏi", không phải "embedding tốt hơn".
 *
 * ── VÌ SAO KHÔNG LỌC SẴN THEO POLICY ─────────────────────────────────────────
 *
 * Mặc định xếp hạng trên TOÀN BỘ 193 chunk, gồm cả PRODUCT và REVIEW, vì lúc
 * chạy thật mô hình có thể gọi `search_knowledge_base` mà không truyền
 * `sourceTypes`. Đo trên tập đã lọc sẵn là đo một hệ dễ hơn hệ đang chạy.
 * `--policy-only` bật bộ lọc để biết việc định tuyến đáng giá bao nhiêu điểm.
 *
 * ── NGƯỠNG SIMILARITY LÀ MỘT ĐÁNH ĐỔI, KHÔNG PHẢI MỘT HẰNG SỐ ────────────────
 *
 * `--sweep` quét ngưỡng trên hai tập ngược chiều nhau: câu có đáp án thì ngưỡng
 * cao làm MẤT đáp án, câu ngoài ngữ liệu thì ngưỡng thấp làm hệ thống đưa ngữ
 * cảnh lạc đề cho mô hình và mở đường cho nó bịa. Không có ngưỡng nào tốt cho
 * cả hai, nên việc của bảng đó là cho thấy cái giá của mỗi lựa chọn.
 */

const CACHE_DIR = path.join(__dirname, "cache");
const CACHE_FILE = path.join(CACHE_DIR, "query-embeddings.json");
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 15000;
const K_VALUES = [1, 3, 5, 10];
const NDCG_K = 5;
const MRR_K = 10;
// Dải quét phải phủ tới 0.85: điểm cosine thực tế nằm quanh 0.75, nên một dải
// dừng ở 0.6 chỉ cho thấy toàn số 100% và không nói được gì.
const SWEEP_THRESHOLDS = [0.3, 0.5, 0.6, 0.65, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.85];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const pct = (x) => (x * 100).toFixed(1);

const parseArgs = (argv) => {
  const args = { policyOnly: false, sweep: false, refresh: false };
  argv.slice(2).forEach((raw) => {
    if (raw === "--policy-only") args.policyOnly = true;
    else if (raw === "--sweep") args.sweep = true;
    else if (raw === "--refresh") args.refresh = true;
  });
  return args;
};

// Dòng heading mở đầu chunk là thứ duy nhất định danh được chunk qua các lần
// embed lại, vì `embedChunks.js` truncate bảng nên UUID luôn đổi.
function headingOf(content) {
  const first = String(content).split("\n").find((l) => l.trim().length > 0) || "";
  const match = first.trim().match(/^#{1,6}\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// Chunk chỉ có đúng dòng tiêu đề, không có nội dung nào bên dưới.
function isTitleOnly(content) {
  const lines = String(content).split("\n").filter((l) => l.trim().length > 0);
  return lines.length === 1 && /^#{1,6}\s+/.test(lines[0].trim());
}

const keyOf = (doc, heading) => `${doc}\u0000${heading}`;

/* ─── Ngữ liệu và đáp án ──────────────────────────────────────────────────── */

async function loadIndex(policyOnly) {
  const rows = await db.DocumentChunk.findAll({
    attributes: ["id", "sourceType", "sourceName", "content", "embedding"],
    raw: true,
  });

  const all = rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    content: row.content,
    heading: headingOf(row.content),
    titleOnly: isTitleOnly(row.content),
    embedding: Float32Array.from(row.embedding),
  }));

  const chunks = policyOnly ? all.filter((c) => c.sourceType === "POLICY") : all;

  const byKey = new Map();
  chunks.forEach((chunk, index) => {
    if (chunk.sourceType !== "POLICY" || !chunk.heading) return;
    const key = keyOf(chunk.sourceName, chunk.heading);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(index);
  });

  return { all, chunks, byKey };
}

// Một đáp án không tra được nghĩa là bộ câu hỏi vàng sai, không phải bộ truy hồi
// kém. Dừng hẳn thay vì lặng lẽ chấm câu đó 0 điểm.
function resolveGold(byKey) {
  const resolved = new Map();
  const problems = [];

  for (const question of questions) {
    const golds = new Map();
    for (const gold of question.gold) {
      const hits = byKey.get(keyOf(gold.doc, gold.heading));
      if (!hits || hits.length === 0) {
        problems.push(`${question.id}: không có chunk nào khớp "${gold.doc}" / "${gold.heading}"`);
        continue;
      }
      if (hits.length > 1) {
        problems.push(`${question.id}: "${gold.doc}" / "${gold.heading}" khớp ${hits.length} chunk`);
      }
      golds.set(hits[0], gold.rel);
    }
    resolved.set(question.id, golds);
  }

  if (problems.length > 0) {
    console.error("\nBộ câu hỏi vàng không khớp ngữ liệu:\n");
    problems.forEach((p) => console.error("  " + p));
    console.error("\nChạy lại `node src/seed/embedChunks.js` hoặc sửa golden.js.\n");
    process.exit(1);
  }

  return resolved;
}

/* ─── Embedding câu hỏi, có cache trên đĩa ────────────────────────────────── */

// Quota embedding của free tier là 100 đơn vị/phút, mà bảng ngưỡng cần chạy lại
// nhiều lần. Cache theo nguyên văn câu hỏi để chỉ lần đầu tốn quota.
async function embedQuestions(texts, refresh) {
  let cache = { model: ragService.EMBEDDING_MODEL, byText: {} };

  if (!refresh && fs.existsSync(CACHE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (parsed.model === ragService.EMBEDDING_MODEL) cache = parsed;
    } catch {
      // Cache hỏng thì bỏ qua, embed lại từ đầu.
    }
  }

  const missing = texts.filter((t) => !cache.byText[t]);
  if (missing.length > 0) {
    console.log(`Embedding ${missing.length} câu hỏi (${texts.length - missing.length} lấy từ cache)...`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const vectors = await ragService.embedBatch(batch, "RETRIEVAL_QUERY");
      batch.forEach((text, j) => {
        cache.byText[text] = vectors[j].map((v) => Number(v.toFixed(6)));
      });
      console.log(`  ${Math.min(i + BATCH_SIZE, missing.length)}/${missing.length}`);
      if (i + BATCH_SIZE < missing.length) await sleep(BATCH_DELAY_MS);
    }

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } else {
    console.log(`Dùng lại toàn bộ ${texts.length} embedding trong cache.`);
  }

  const out = new Map();
  texts.forEach((t) => out.set(t, Float32Array.from(cache.byText[t])));
  return out;
}

/* ─── Ba cách xếp hạng ────────────────────────────────────────────────────── */

const STOPWORDS = new Set([
  "là", "và", "của", "có", "không", "thì", "được", "cho", "khi", "với", "trong",
  "tôi", "bao", "nhiêu", "gì", "nào", "sao", "ở", "đâu", "mà", "này", "đó", "một",
  "các", "những", "để", "về", "ra", "vào", "lại", "rồi", "đã", "sẽ", "bị", "phải",
  "nếu", "hay", "hoặc", "như", "thế", "làm", "muốn", "cần", "còn", "chỉ", "từ",
  "trên", "dưới", "đến", "theo", "sau", "trước", "tại", "bằng", "nữa", "quá",
]);

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function rankByVector(queryEmbedding, chunks) {
  return chunks
    .map((chunk, index) => ({ index, score: ragService.cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score);
}

// BM25 chuẩn, k1 = 1.5 và b = 0.75. Đây là baseline nghiêm túc, không phải bù nhìn.
function buildBm25(chunks) {
  const docs = chunks.map((c) => tokenize(c.content));
  const avgdl = docs.reduce((sum, d) => sum + d.length, 0) / (docs.length || 1);

  const df = new Map();
  docs.forEach((doc) => {
    new Set(doc).forEach((term) => df.set(term, (df.get(term) || 0) + 1));
  });

  const tfs = docs.map((doc) => {
    const tf = new Map();
    doc.forEach((term) => tf.set(term, (tf.get(term) || 0) + 1));
    return tf;
  });

  const N = docs.length;
  const k1 = 1.5;
  const b = 0.75;

  return function rank(query) {
    const terms = tokenize(query);
    return docs
      .map((doc, index) => {
        let score = 0;
        for (const term of terms) {
          const tf = tfs[index].get(term);
          if (!tf) continue;
          const idf = Math.log(1 + (N - df.get(term) + 0.5) / (df.get(term) + 0.5));
          score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avgdl)));
        }
        return { index, score };
      })
      .sort((a, b2) => b2.score - a.score);
  };
}

// Đếm số từ khoá riêng biệt của câu hỏi xuất hiện trong chunk — tương đương một
// câu SQL nối nhiều mệnh đề LIKE.
function buildLike(chunks) {
  const haystacks = chunks.map((c) => c.content.toLowerCase());
  return function rank(query) {
    const terms = [...new Set(tokenize(query))];
    return haystacks
      .map((text, index) => ({
        index,
        score: terms.reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score);
  };
}

/* ─── Số đo ───────────────────────────────────────────────────────────────── */

function scoreRanking(ranking, golds) {
  const totalGold = golds.size;
  const result = { hit: {}, recall: {}, rr: 0, ndcg: 0 };

  K_VALUES.forEach((k) => {
    const top = ranking.slice(0, k);
    const found = top.filter((r) => golds.has(r.index)).length;
    result.hit[k] = found > 0 ? 1 : 0;
    result.recall[k] = totalGold > 0 ? found / totalGold : 0;
  });

  const firstGold = ranking.slice(0, MRR_K).findIndex((r) => golds.has(r.index));
  result.rr = firstGold === -1 ? 0 : 1 / (firstGold + 1);

  // Gain 2^rel − 1, cùng quy ước với phép đo recommender ở 6.4.
  let dcg = 0;
  ranking.slice(0, NDCG_K).forEach((r, i) => {
    const rel = golds.get(r.index) || 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  });

  let idcg = 0;
  [...golds.values()].sort((a, b) => b - a).slice(0, NDCG_K).forEach((rel, i) => {
    idcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  });

  result.ndcg = idcg > 0 ? dcg / idcg : 0;
  return result;
}

function aggregate(scores) {
  const n = scores.length || 1;
  const out = { n: scores.length, hit: {}, recall: {}, mrr: 0, ndcg: 0 };
  K_VALUES.forEach((k) => {
    out.hit[k] = scores.reduce((s, x) => s + x.hit[k], 0) / n;
    out.recall[k] = scores.reduce((s, x) => s + x.recall[k], 0) / n;
  });
  out.mrr = scores.reduce((s, x) => s + x.rr, 0) / n;
  out.ndcg = scores.reduce((s, x) => s + x.ndcg, 0) / n;
  return out;
}

/* ─── In kết quả ──────────────────────────────────────────────────────────── */

const GROUPS = [
  ["NUMERIC", "ràng buộc số"],
  ["SEMANTIC", "ngữ nghĩa"],
  ["POLICY", "chính sách"],
];

function printRunTable(title, byMethodGroup) {
  console.log(`\n${title}`);
  console.log(
    pad("Cách xếp hạng", 16) + pad("Nhóm", 16) + padL("n", 4) +
    K_VALUES.map((k) => padL(`HR@${k}`, 8)).join("") +
    padL("R@5", 8) + padL(`MRR@${MRR_K}`, 9) + padL(`nDCG@${NDCG_K}`, 10),
  );
  console.log("-".repeat(16 + 16 + 4 + 8 * K_VALUES.length + 8 + 9 + 10));

  for (const [method, byGroup] of byMethodGroup) {
    for (const [group, label] of [...GROUPS, ["ALL", "tất cả"]]) {
      const a = byGroup.get(group);
      if (!a) continue;
      console.log(
        pad(group === "NUMERIC" ? method : "", 16) + pad(label, 16) + padL(a.n, 4) +
        K_VALUES.map((k) => padL(pct(a.hit[k]), 8)).join("") +
        padL(pct(a.recall[5]), 8) + padL(a.mrr.toFixed(3), 9) + padL(a.ndcg.toFixed(3), 10),
      );
    }
    console.log("-".repeat(16 + 16 + 4 + 8 * K_VALUES.length + 8 + 9 + 10));
  }
  console.log("HR@k = tỉ lệ câu có ít nhất một đáp án trong top k. R@5 = phần đáp án lấy được ở top 5.");
}

function printSweep(inCorpus, outCorpus) {
  console.log("\nQuét ngưỡng similarity — hai tập đi ngược chiều nhau");
  console.log(
    pad("ngưỡng", 9) + padL("giữ đáp án", 13) + padL("mất hẳn", 10) +
    padL("bịa được", 11) + padL("top1 có đáp", 13) + padL("top1 ngoài", 12),
  );
  console.log("-".repeat(68));

  SWEEP_THRESHOLDS.forEach((t) => {
    const kept = inCorpus.filter((x) => x.goldScoreInTopK >= t).length / inCorpus.length;
    const empty = inCorpus.filter((x) => x.topScore < t).length / inCorpus.length;
    const risky = outCorpus.filter((x) => x.topScore >= t).length / outCorpus.length;
    const meanIn = inCorpus.reduce((s, x) => s + x.topScore, 0) / inCorpus.length;
    const meanOut = outCorpus.reduce((s, x) => s + x.topScore, 0) / outCorpus.length;

    const mark = t === ragService.DEFAULT_THRESHOLD ? " ←hiện tại" : "";
    console.log(
      pad(t.toFixed(2), 9) + padL(pct(kept), 13) + padL(pct(empty), 10) +
      padL(pct(risky), 11) + padL(meanIn.toFixed(3), 13) + padL(meanOut.toFixed(3), 12) + mark,
    );
  });

  console.log(
    "\ngiữ đáp án = câu có đáp án vẫn nằm trong top-K sau khi cắt ngưỡng." +
    "\nmất hẳn    = câu có đáp án nhưng không chunk nào qua ngưỡng, trợ lý trả lời rỗng." +
    "\nbịa được   = câu NGOÀI ngữ liệu vẫn nhận được ngữ cảnh, tức là có nguyên liệu để bịa.",
  );

  printSeparation(inCorpus.map((x) => x.topScore), outCorpus.map((x) => x.topScore));
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

// Ngưỡng chỉ dùng được nếu điểm cao nhất của câu CÓ đáp án tách khỏi điểm cao
// nhất của câu KHÔNG có đáp án. Hai phân bố chồng nhau thì không ngưỡng nào cứu được.
function printSeparation(inScores, outScores) {
  const a = [...inScores].sort((x, y) => x - y);
  const b = [...outScores].sort((x, y) => x - y);

  console.log("\nPhân bố điểm top-1");
  console.log(pad("tập", 22) + padL("min", 8) + padL("p25", 8) + padL("trung vị", 10) + padL("p75", 8) + padL("max", 8));
  console.log("-".repeat(64));
  console.log(pad("câu có đáp án", 22) + padL(a[0].toFixed(3), 8) + padL(quantile(a, 0.25).toFixed(3), 8) + padL(quantile(a, 0.5).toFixed(3), 10) + padL(quantile(a, 0.75).toFixed(3), 8) + padL(a[a.length - 1].toFixed(3), 8));
  console.log(pad("câu ngoài ngữ liệu", 22) + padL(b[0].toFixed(3), 8) + padL(quantile(b, 0.25).toFixed(3), 8) + padL(quantile(b, 0.5).toFixed(3), 10) + padL(quantile(b, 0.75).toFixed(3), 8) + padL(b[b.length - 1].toFixed(3), 8));

  // Ngưỡng tốt nhất có thể: quét mọi điểm cắt, lấy cái phân loại đúng nhiều nhất.
  const cuts = [...new Set([...a, ...b])].sort((x, y) => x - y);
  let best = { t: 0, acc: 0 };
  for (const t of cuts) {
    const correct = a.filter((s) => s >= t).length + b.filter((s) => s < t).length;
    const acc = correct / (a.length + b.length);
    if (acc > best.acc) best = { t, acc };
  }
  const baseline = a.length / (a.length + b.length);

  console.log(
    `\nNgưỡng tốt nhất có thể: ${best.t.toFixed(3)} — phân loại đúng ${pct(best.acc)}% ` +
    `(nhận hết không xét gì đã được ${pct(baseline)}%).`,
  );
}

/* ─── Chạy ────────────────────────────────────────────────────────────────── */

async function run() {
  const args = parseArgs(process.argv);

  console.log("=== Đo bộ truy hồi RAG ===");
  await db.sequelize.authenticate();

  const { all, chunks, byKey } = await loadIndex(args.policyOnly);
  const gold = resolveGold(byKey);

  const byType = all.reduce((acc, c) => ({ ...acc, [c.sourceType]: (acc[c.sourceType] || 0) + 1 }), {});
  console.log(
    `\nNgữ liệu: ${all.length} chunk (` +
    Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(", ") + ")",
  );
  console.log(`Xếp hạng trên: ${chunks.length} chunk${args.policyOnly ? " (chỉ POLICY)" : " (toàn bộ)"}`);
  console.log(`Câu hỏi: ${questions.length} có đáp án, ${outOfCorpus.length} ngoài ngữ liệu`);

  const titleOnly = all.filter((c) => c.titleOnly);
  if (titleOnly.length > 0) {
    console.log(`Cảnh báo: ${titleOnly.length} chunk chỉ có dòng tiêu đề, không có nội dung.`);
  }

  const allTexts = [...questions.map((q) => q.q), ...outOfCorpus.map((q) => q.q)];
  const embeddings = await embedQuestions(allTexts, args.refresh);

  const rankBm25 = buildBm25(chunks);
  const rankLike = buildLike(chunks);

  const methods = [
    ["vector", (q) => rankByVector(embeddings.get(q), chunks)],
    ["BM25", (q) => rankBm25(q)],
    ["LIKE", (q) => rankLike(q)],
  ];

  const byMethodGroup = new Map();
  let titleNoise = 0;

  for (const [method, rank] of methods) {
    const perGroup = new Map();
    const everything = [];

    for (const question of questions) {
      const ranking = rank(question.q);
      const score = scoreRanking(ranking, gold.get(question.id));

      if (!perGroup.has(question.group)) perGroup.set(question.group, []);
      perGroup.get(question.group).push(score);
      everything.push(score);

      if (method === "vector") {
        titleNoise += ranking.slice(0, 5).filter((r) => chunks[r.index].titleOnly).length;
      }
    }

    const aggregated = new Map();
    for (const [group, scores] of perGroup) aggregated.set(group, aggregate(scores));
    aggregated.set("ALL", aggregate(everything));
    byMethodGroup.set(method, aggregated);
  }

  printRunTable("Bộ truy hồi so với hai baseline khớp từ khoá", byMethodGroup);

  if (titleOnly.length > 0) {
    const slots = questions.length * 5;
    console.log(
      `\nNhiễu tiêu đề: ${titleNoise}/${slots} ô trong top-5 của bộ truy hồi vector ` +
      `(${pct(titleNoise / slots)}%) rơi vào chunk chỉ có dòng tiêu đề.`,
    );
  }

  if (args.sweep) {
    const inCorpus = questions.map((question) => {
      const ranking = rankByVector(embeddings.get(question.q), chunks);
      const golds = gold.get(question.id);
      const topK = ranking.slice(0, ragService.DEFAULT_K);
      const goldHit = topK.find((r) => golds.has(r.index));
      return {
        topScore: ranking[0]?.score ?? 0,
        goldScoreInTopK: goldHit ? goldHit.score : -1,
      };
    });

    const outCorpusScores = outOfCorpus.map((question) => ({
      topScore: rankByVector(embeddings.get(question.q), chunks)[0]?.score ?? 0,
    }));

    printSweep(inCorpus, outCorpusScores);
  }

  console.log("");
  process.exit(0);
}

run().catch((error) => {
  console.error("Đo thất bại:", error);
  process.exit(1);
});
