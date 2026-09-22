// Chunk & embed: đọc policies, product descriptions, reviews → tạo embeddings → lưu DB.
// Chạy: node src/seed/embedChunks.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../models");
const { embedBatch, EMBEDDING_MODEL } = require("../services/ragService");
const logger = require("../utils/logger");

const POLICIES_DIR = path.join(__dirname, "../data/policies");
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Chunk phải có ít nhất một dòng nội dung dưới heading. Phần đứng trước `##` đầu
// tiên của mỗi tệp thường chỉ còn đúng dòng tiêu đề: nó ăn điểm cosine cao vì
// trùng chủ đề câu hỏi nhưng không mang thông tin nào cho mô hình.
function hasBody(text) {
  return text.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
}

// Chunk policy file theo heading. Mỗi heading ## tạo chunk mới.
function chunkPolicyFile(filename, content) {
  const lines = content.split("\n");
  const chunks = [];
  let current = [];
  let title = filename.replace(/\.md$/, "");

  for (const line of lines) {
    if (line.startsWith("# ") && current.length === 0) {
      title = line.replace(/^#\s+/, "").trim();
      current.push(line);
    } else if (line.startsWith("## ")) {
      if (current.length > 0) {
        const text = current.join("\n").trim();
        if (hasBody(text)) {
          chunks.push(text);
        }
      }
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    const text = current.join("\n").trim();
    if (hasBody(text)) {
      chunks.push(text);
    }
  }

  return { title, chunks };
}

async function loadPolicyChunks() {
  const entries = [];

  if (!fs.existsSync(POLICIES_DIR)) {
    logger.warn("No policies directory found at " + POLICIES_DIR);
    return entries;
  }

  const files = fs.readdirSync(POLICIES_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(POLICIES_DIR, file), "utf-8");
    const { title, chunks } = chunkPolicyFile(file, content);

    chunks.forEach((text, index) => {
      entries.push({
        sourceType: "POLICY",
        sourceId: null,
        sourceName: title,
        chunkIndex: index,
        content: text,
        tokenCount: estimateTokens(text),
      });
    });
  }

  return entries;
}

async function loadProductChunks() {
  const entries = [];
  const products = await db.Product.findAll({
    attributes: ["id", "name", "description", "shortDescription"],
    where: { status: "ACTIVE" },
    raw: true,
  });

  for (const product of products) {
    const text = [product.name, product.shortDescription, product.description]
      .filter(Boolean)
      .join("\n\n");

    if (text.length < 30) continue;

    entries.push({
      sourceType: "PRODUCT",
      sourceId: product.id,
      sourceName: product.name,
      chunkIndex: 0,
      content: text,
      tokenCount: estimateTokens(text),
    });
  }

  return entries;
}

async function loadReviewChunks() {
  const entries = [];
  const reviews = await db.Review.findAll({
    attributes: ["id", "productId", "title", "content", "rating"],
    where: { status: "APPROVED" },
    include: [{ model: db.Product, as: "product", attributes: ["name"] }],
    raw: true,
    nest: true,
  });

  // Gom reviews theo product: review ngắn (<100 chars) nối lại thành 1 chunk.
  const byProduct = new Map();
  for (const review of reviews) {
    const pid = review.productId;
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push(review);
  }

  for (const [productId, productReviews] of byProduct) {
    const long = productReviews.filter((r) => (r.content || "").length >= 100);
    const short = productReviews.filter((r) => (r.content || "").length < 100);
    const productName = productReviews[0]?.product?.name || "Unknown product";

    let chunkIndex = 0;

    for (const review of long) {
      const text = [`Rating: ${review.rating}/5`, review.title, review.content]
        .filter(Boolean)
        .join("\n");

      entries.push({
        sourceType: "REVIEW",
        sourceId: productId,
        sourceName: productName,
        chunkIndex: chunkIndex++,
        content: text,
        tokenCount: estimateTokens(text),
      });
    }

    if (short.length > 0) {
      const merged = short
        .map((r) => [`[${r.rating}/5] ${r.title || ""}`, r.content].filter(Boolean).join(": "))
        .join("\n");

      entries.push({
        sourceType: "REVIEW",
        sourceId: productId,
        sourceName: productName,
        chunkIndex: chunkIndex,
        content: merged,
        tokenCount: estimateTokens(merged),
      });
    }
  }

  return entries;
}

async function run() {
  console.log("=== Embed Chunks Seeder ===\n");

  await db.sequelize.authenticate();
  await db.sequelize.sync();

  console.log("Loading chunks...");
  const policyChunks = await loadPolicyChunks();
  const productChunks = await loadProductChunks();
  const reviewChunks = await loadReviewChunks();

  const allChunks = [...policyChunks, ...productChunks, ...reviewChunks];
  console.log(
    `Chunks: ${policyChunks.length} policy, ${productChunks.length} product, ${reviewChunks.length} review = ${allChunks.length} total`,
  );

  if (allChunks.length === 0) {
    console.log("Nothing to embed.");
    process.exit(0);
  }

  // `--dry-run`: xem kết quả cắt chunk mà không truncate bảng và không tốn quota.
  if (process.argv.includes("--dry-run")) {
    console.log("\nPolicy chunks theo tài liệu:");
    const byDoc = new Map();
    policyChunks.forEach((c) => byDoc.set(c.sourceName, (byDoc.get(c.sourceName) || 0) + 1));
    [...byDoc].forEach(([name, n]) => console.log(`  ${String(n).padStart(3)}  ${name}`));

    const shortest = [...policyChunks].sort((a, b) => a.content.length - b.content.length).slice(0, 5);
    console.log("\nNăm chunk ngắn nhất:");
    shortest.forEach((c) => console.log(`  ${String(c.content.length).padStart(5)} ký tự  ${JSON.stringify(c.content.slice(0, 50))}`));

    console.log("\nDry run, không ghi gì vào database.");
    process.exit(0);
  }

  console.log("\nTruncating document_chunks...");
  await db.DocumentChunk.destroy({ where: {}, truncate: true });

  console.log(`Embedding in batches of ${BATCH_SIZE}...`);
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    const embeddings = await embedBatch(texts);

    const rows = batch.map((chunk, j) => ({
      ...chunk,
      embedding: Array.from(embeddings[j]),
      embeddingModel: EMBEDDING_MODEL,
    }));

    await db.DocumentChunk.bulkCreate(rows);
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} chunks embedded`);

    if (i + BATCH_SIZE < allChunks.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const count = await db.DocumentChunk.count();
  console.log(`\nDone! ${count} chunks in database.`);
  process.exit(0);
}

// Chỉ tự chạy khi gọi trực tiếp, để bộ test require được các hàm cắt chunk.
if (require.main === module) {
  run().catch((error) => {
    console.error("Embed chunks failed:", error);
    process.exit(1);
  });
}

module.exports = { chunkPolicyFile, hasBody, estimateTokens };
