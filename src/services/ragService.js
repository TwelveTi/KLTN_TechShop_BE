// RAG retriever: load document chunks vào RAM, tìm kiếm bằng cosine similarity.
const { getClient, isConfigured } = require("../configs/geminiConfig");
const logger = require("../utils/logger");

const EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_K = 5;
const DEFAULT_THRESHOLD = 0.3;

let chunks = [];
let loaded = false;
let loading = null;

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Free tier limits embedding to 100 units/minute regardless of how many HTTP
// calls that's split across. A 429 here is routine, not exceptional, so it is
// retried using Google's own `retryDelay` — but only up to `maxWaitMs` per
// attempt. The seed script can afford to sit out a 60s quota window; a live
// advisor request cannot, and should fall through to an empty result rather
// than hold the shopper's request hostage to a batch-sized wait.
async function embedWithRetry(fn, { retries = 4, maxWaitMs = 60000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isQuota = error?.status === 429;
      if (!isQuota || attempt >= retries) throw error;

      const match = String(error?.message || "").match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
      const waitMs = Math.min(
        match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : (attempt + 1) * 5000,
        maxWaitMs,
      );

      logger.warn(`RAG: embedding quota hit, retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
    }
  }
}

// Query-time embedding: one short retry, then give up. This runs inside a
// live advisor request, so it must fail fast — an empty knowledge-base result
// is a fine answer, a request that hangs for a quota window is not.
async function embedText(text, taskType = "RETRIEVAL_QUERY") {
  const client = getClient();
  const result = await embedWithRetry(
    () =>
      client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { taskType },
      }),
    { retries: 1, maxWaitMs: 5000 },
  );
  return result.embeddings[0].values;
}

// `embedContent` takes an array of strings directly — there is no separate
// batch method on this SDK. One `taskType` applies to every string in the call.
// Runs only from the offline seed script, so the generous default retry budget
// (full quota wait, several attempts) is fine here.
async function embedBatch(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const client = getClient();
  const result = await embedWithRetry(() =>
    client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { taskType },
    }),
  );
  return result.embeddings.map((e) => e.values);
}

async function loadChunks() {
  if (loaded) return;
  if (loading) return loading;

  loading = (async () => {
    try {
      const db = require("../models");
      const rows = await db.DocumentChunk.findAll({
        attributes: ["id", "sourceType", "sourceId", "sourceName", "chunkIndex", "content", "embedding"],
        raw: true,
      });

      chunks = rows.map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        chunkIndex: row.chunkIndex,
        content: row.content,
        embedding: new Float32Array(row.embedding),
      }));

      loaded = true;
      logger.info(`RAG: loaded ${chunks.length} chunks into RAM`);
    } catch (error) {
      logger.error("RAG: failed to load chunks", { error: logger.serializeError(error) });
      throw error;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

async function search(query, { sourceTypes = null, k = DEFAULT_K, threshold = DEFAULT_THRESHOLD } = {}) {
  if (!isConfigured()) return [];

  await loadChunks();
  if (chunks.length === 0) return [];

  const queryEmbedding = new Float32Array(await embedText(query));

  let candidates = chunks;
  if (sourceTypes && sourceTypes.length > 0) {
    candidates = chunks.filter((c) => sourceTypes.includes(c.sourceType));
  }

  const scored = candidates.map((chunk) => ({
    content: chunk.content,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    sourceName: chunk.sourceName,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.filter((r) => r.score >= threshold).slice(0, k);
}

function reloadChunks() {
  loaded = false;
  chunks = [];
  loading = null;
}

module.exports = {
  search,
  loadChunks,
  reloadChunks,
  embedText,
  embedBatch,
  // Bộ đo xếp hạng lại tại chỗ nên phải dùng đúng hàm chấm điểm của production.
  cosineSimilarity,
  EMBEDDING_MODEL,
  DEFAULT_K,
  DEFAULT_THRESHOLD,
};
