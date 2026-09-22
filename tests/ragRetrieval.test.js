// Test phần truy hồi RAG: phép chấm điểm tương đồng và luật cắt chunk.
const test = require("node:test");
const assert = require("node:assert/strict");

const { cosineSimilarity, DEFAULT_K, DEFAULT_THRESHOLD } = require("../src/services/ragService");
const { chunkPolicyFile, hasBody } = require("../src/seed/embedChunks");

test.describe("cosineSimilarity", () => {
  test("hai vector trùng hướng cho 1", () => {
    const v = Float32Array.from([1, 2, 3]);
    assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-6);
  });

  test("không phụ thuộc độ dài vector, chỉ phụ thuộc hướng", () => {
    const a = Float32Array.from([1, 2, 3]);
    const b = Float32Array.from([10, 20, 30]);
    assert.ok(Math.abs(cosineSimilarity(a, b) - 1) < 1e-6);
  });

  test("vuông góc cho 0, ngược hướng cho -1", () => {
    assert.equal(cosineSimilarity(Float32Array.from([1, 0]), Float32Array.from([0, 1])), 0);
    assert.ok(Math.abs(cosineSimilarity(Float32Array.from([1, 0]), Float32Array.from([-1, 0])) + 1) < 1e-6);
  });

  test("vector rỗng toàn số 0 trả về 0 thay vì NaN", () => {
    // Chia cho 0 ở đây sẽ lặng lẽ đẩy NaN vào bảng xếp hạng.
    assert.equal(cosineSimilarity(Float32Array.from([0, 0]), Float32Array.from([1, 2])), 0);
  });

  test("đối xứng", () => {
    const a = Float32Array.from([0.2, -0.5, 0.9]);
    const b = Float32Array.from([0.7, 0.1, -0.3]);
    assert.equal(cosineSimilarity(a, b), cosineSimilarity(b, a));
  });
});

test.describe("hasBody — luật loại chunk rỗng ruột", () => {
  // Hồi quy cho lỗi 15 của nhật ký AI: luật cũ là độ dài > 20 ký tự, nên 8 chunk
  // chỉ chứa dòng tiêu đề vẫn lọt vào chỉ mục và chiếm 16% số ô trong top-5.
  test("chỉ có dòng tiêu đề thì bị loại, dù dài hơn 20 ký tự", () => {
    assert.equal(hasBody("# Chính sách bảo hành"), false);
    assert.equal(hasBody("# Chương trình thành viên TechShop"), false);
  });

  test("tiêu đề chồng tiêu đề mà không có nội dung vẫn bị loại", () => {
    assert.equal(hasBody("## Thời gian bảo hành\n\n### Laptop"), false);
  });

  test("có ít nhất một dòng nội dung thì giữ lại", () => {
    assert.equal(hasBody("## Phí vận chuyển\n\nMiễn phí cho đơn từ 500.000 VND."), true);
  });

  test("chuỗi rỗng hoặc chỉ khoảng trắng thì bị loại", () => {
    assert.equal(hasBody(""), false);
    assert.equal(hasBody("\n  \n"), false);
  });
});

test.describe("chunkPolicyFile", () => {
  const doc = [
    "# Chính sách thử nghiệm",
    "",
    "## Mục một",
    "",
    "Nội dung của mục một.",
    "",
    "## Mục hai",
    "",
    "### Mục con",
    "",
    "Nội dung của mục hai.",
  ].join("\n");

  test("lấy tiêu đề cấp một của tệp làm tên tài liệu", () => {
    const { title } = chunkPolicyFile("thu-nghiem.md", doc);
    assert.equal(title, "Chính sách thử nghiệm");
  });

  test("cắt theo tiêu đề cấp hai, và không sinh chunk cho phần chỉ có tiêu đề tệp", () => {
    const { chunks } = chunkPolicyFile("thu-nghiem.md", doc);

    // Đúng hai chunk: phần đứng trước `## Mục một` chỉ có dòng tiêu đề nên bị bỏ.
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0].startsWith("## Mục một"));
    assert.ok(chunks[1].startsWith("## Mục hai"));
  });

  test("tiêu đề cấp ba nằm lại trong chunk cha, không tách ra", () => {
    const { chunks } = chunkPolicyFile("thu-nghiem.md", doc);
    assert.ok(chunks[1].includes("### Mục con"));
  });

  test("tệp không có tiêu đề cấp hai nào thì cho đúng một chunk", () => {
    const { chunks } = chunkPolicyFile("ngan.md", "# Tiêu đề\n\nMột đoạn nội dung duy nhất.");
    assert.equal(chunks.length, 1);
  });
});

test.describe("hằng số truy hồi", () => {
  // Ngưỡng được đo là không phân biệt được câu có đáp án với câu ngoài ngữ liệu
  // (README 7.8.6.2). Test này không khẳng định giá trị nào là đúng, nó chỉ chốt
  // giá trị đang chạy để một lần đổi vô tình không trôi qua mà không ai biết.
  test("K và ngưỡng mặc định đúng như tài liệu mô tả", () => {
    assert.equal(DEFAULT_K, 5);
    assert.equal(DEFAULT_THRESHOLD, 0.3);
  });
});
