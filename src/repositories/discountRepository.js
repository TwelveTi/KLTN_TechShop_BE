const { Op } = require("sequelize");
const db = require("../models");

// Data-access for voucher codes and their redemptions.
class DiscountRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // `lock` is what makes a usage-limited code safe under concurrent checkouts:
  // the row stays locked until the order transaction commits, so two shoppers
  // racing for the last redemption are serialized instead of both winning.
  findByCode(code, { transaction, lock } = {}) {
    return db.Discount.findOne({
      where: { code },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findById(id, { transaction, lock } = {}) {
    return db.Discount.findByPk(id, {
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findAndCountAll({ where, limit, offset }) {
    return db.Discount.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  create(data, { transaction } = {}) {
    return db.Discount.create(data, { transaction });
  }

  update(discount, changes, { transaction } = {}) {
    return discount.update(changes, { transaction });
  }

  destroy(discount, { transaction } = {}) {
    return discount.destroy({ transaction });
  }

  incrementUsedCount(discount, by, { transaction }) {
    return discount.increment("usedCount", { by, transaction });
  }

  decrementUsedCount(discount, by, { transaction }) {
    return discount.decrement("usedCount", { by, transaction });
  }

  // ── Redemptions ───────────────────────────────────────────────────────────

  // Only redemptions that are still standing count against a per-user limit;
  // a cancelled order releases its use.
  countActiveUsagesByUser(discountId, userId, { transaction } = {}) {
    return db.DiscountUsage.count({
      where: { discountId, userId, releasedAt: { [Op.is]: null } },
      transaction,
    });
  }

  createUsage(data, { transaction } = {}) {
    return db.DiscountUsage.create(data, { transaction });
  }

  findActiveUsagesByOrder(orderId, { transaction } = {}) {
    return db.DiscountUsage.findAll({
      where: { orderId, releasedAt: { [Op.is]: null } },
      transaction,
    });
  }

  updateUsage(usage, changes, { transaction } = {}) {
    return usage.update(changes, { transaction });
  }

  countUsages(discountId, { transaction } = {}) {
    return db.DiscountUsage.count({ where: { discountId }, transaction });
  }
}

module.exports = new DiscountRepository();
