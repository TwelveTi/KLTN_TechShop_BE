const db = require("../../models");
const discountsData = require("../data/discounts.data");

/**
 * Seeds demo vouchers. cleaner.js cố ý không xoá bảng discounts để giữ voucher
 * tạo tay, nên ở đây tìm theo mã: chưa có thì tạo, có rồi thì làm mới hạn dùng.
 * usedCount về 0 vì đơn và discount_usages vừa bị xoá cùng lượt seed.
 */
async function seedDiscounts(transaction) {
  console.log("  Seeding Discounts...");

  let created = 0;
  for (const item of discountsData) {
    const existing = await db.Discount.findOne({ where: { code: item.code }, paranoid: false, transaction });

    if (!existing) {
      await db.Discount.create({ ...item, usedCount: 0 }, { transaction });
      created += 1;
      continue;
    }

    if (existing.deletedAt) await existing.restore({ transaction });
    await existing.update({ ...item, usedCount: 0 }, { transaction });
  }

  console.log(`    ${created} created, ${discountsData.length - created} refreshed.`);
}

module.exports = { seedDiscounts };
