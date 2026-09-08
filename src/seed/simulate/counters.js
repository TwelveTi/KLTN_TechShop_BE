const { Op } = require("sequelize");
const db = require("../../models");
const productsData = require("../data/products.data");

/**
 * `products.soldCount` / `products.viewCount` cho thế giới mô phỏng.
 *
 * ── Vì sao tồn tại (2026-09-08) ──────────────────────────────────────────────
 *
 * `scorePopularity` chấm điểm bằng hai cột đó. Trước đây `simulate` chỉ ghi
 * `user_behaviors` và không đụng tới chúng, nên thành phần popularity vẫn chấm
 * trên những con số viết tay trong `seed/data/products.data.js`
 * (`soldCount: 42`, `viewCount: 1520`, …) — hai thế giới song song: persona sống
 * trong thế giới mô phỏng, popularity chấm theo một thế giới khác hẳn.
 *
 * Tách khỏi `simulate/index.js` để `measure.js --loo` dùng lại được: phép đo tách
 * theo thời gian phải tính popularity **chỉ từ phần huấn luyện**, nếu không thì
 * chính lượt mua đang được giấu đi lại cộng vào `soldCount` của đúng sản phẩm cần
 * dự đoán — mô hình đọc được đáp án qua một cửa sau.
 */

/**
 * Tính lại hai cột từ sự kiện thật trong DB.
 *
 * Đọc từ DB chứ không từ `plan`, để chế độ `--keep` (chồng một lượt lên lượt cũ)
 * vẫn ra con số đúng thay vì xoá mất đóng góp của lượt trước.
 *
 * Ghi ĐÈ chứ không cộng dồn: `viewCount` viết tay nằm trong khoảng 800–7800 còn
 * một lượt mô phỏng 90 ngày chỉ sinh ~100 view mỗi sản phẩm, nên cộng dồn thì
 * phần viết tay át hẳn phần mô phỏng và không sửa được gì. Sản phẩm không có sự
 * kiện nào cũng bị đặt về 0 — để nguyên số cũ thì một sản phẩm không ai xem lại
 * "phổ biến" hơn sản phẩm được xem nhiều nhất.
 *
 * @param {string[]} userIds     khách mô phỏng
 * @param {string[]} productIds  sản phẩm cần đặt lại (kể cả sản phẩm 0 sự kiện)
 * @param {Map<string, Date>} [cutoffByUser]  mốc cắt của từng khách; sự kiện từ
 *        mốc đó trở đi KHÔNG được tính. Đây là cách `--loo` lấy được bộ đếm
 *        "chỉ từ phần huấn luyện".
 */
const recomputeFromEvents = async (userIds, productIds, { cutoffByUser = null } = {}) => {
  const views = new Map();
  const sold = new Map();
  let excluded = 0;

  if (userIds.length > 0) {
    const rows = await db.UserBehavior.findAll({
      where: { userId: userIds, productId: { [Op.ne]: null } },
      attributes: ["userId", "behaviorType", "productId", "metadata", "occurredAt"],
      raw: true,
    });

    rows.forEach((row) => {
      const cutoff = cutoffByUser ? cutoffByUser.get(row.userId) : null;

      if (cutoff && new Date(row.occurredAt) >= cutoff) {
        excluded += 1;
        return;
      }

      if (row.behaviorType === "VIEW_PRODUCT") {
        views.set(row.productId, (views.get(row.productId) || 0) + 1);
        return;
      }

      if (row.behaviorType === "PURCHASE") {
        // Cùng đơn vị với đường thật: `paymentService` cộng `item.quantity`, chứ
        // không phải đếm số đơn. Cột JSON có thể về dưới dạng chuỗi tuỳ driver.
        const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata || "{}") : row.metadata || {};
        sold.set(row.productId, (sold.get(row.productId) || 0) + (Number(metadata.quantity) || 1));
      }
    });
  }

  for (const productId of productIds) {
    await db.Product.update(
      { viewCount: views.get(productId) || 0, soldCount: sold.get(productId) || 0 },
      { where: { id: productId } },
    );
  }

  return {
    products: productIds.length,
    withViews: views.size,
    withSales: sold.size,
    views: [...views.values()].reduce((sum, n) => sum + n, 0),
    sold: [...sold.values()].reduce((sum, n) => sum + n, 0),
    excluded,
  };
};

/**
 * Trả hai cột về đúng giá trị `seed:catalog` đã ghi.
 *
 * Nguồn là `seed/data/products.data.js` chứ không phải một file ảnh chụp riêng:
 * file đó CHÍNH LÀ bản ghi chính thức của các con số viết tay, nằm trong repo,
 * khoá theo `slug` (có unique index, không đổi giữa các lượt seed), và không bao
 * giờ lệch pha với thứ `seed:catalog` vừa ghi. Một file ảnh chụp thì có thể cũ
 * hơn catalogue, và khôi phục từ ảnh chụp cũ còn tệ hơn không khôi phục.
 *
 * Sản phẩm không có trong file (catalogue sửa tay, hàng do admin tạo) thì không
 * đụng tới — và được đếm để báo ra, vì im lặng bỏ qua là cách tốt nhất để một
 * lượt khôi phục nửa vời trông như đã xong.
 */
const restoreAuthored = async () => {
  const rows = await db.Product.findAll({ attributes: ["id", "slug"], raw: true });
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));

  let restored = 0;

  for (const item of productsData) {
    const productId = idBySlug.get(item.slug);

    if (!productId) {
      continue;
    }

    await db.Product.update(
      { soldCount: item.soldCount || 0, viewCount: item.viewCount || 0 },
      { where: { id: productId } },
    );
    restored += 1;
  }

  return { restored, untouched: rows.length - restored };
};

module.exports = { recomputeFromEvents, restoreAuthored };
