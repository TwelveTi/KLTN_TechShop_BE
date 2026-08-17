const { Op } = require("sequelize");
const db = require("../models");

// Data-access for payment attempts and the order fields a settlement touches.
class PaymentRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  findOrderByIdForUser(orderId, userId, { transaction } = {}) {
    return db.Order.findOne({ where: { id: orderId, userId }, transaction });
  }

  findOrderById(orderId, { transaction, lock } = {}) {
    return db.Order.findByPk(orderId, {
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findOrderByIdWithItems(orderId, { transaction } = {}) {
    return db.Order.findByPk(orderId, {
      include: [{ model: db.OrderItem, as: "items" }],
      transaction,
    });
  }

  createPayment(data, { transaction } = {}) {
    return db.Payment.create(data, { transaction });
  }

  // The gateway's transaction reference is the lookup key on the way back:
  // vnp_TxnRef arrives on both the browser return and the server IPN.
  findPaymentByTransactionCode(transactionCode, { transaction, lock } = {}) {
    return db.Payment.findOne({
      where: { transactionCode },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  countPaymentsForOrder(orderId, paymentMethod, { transaction } = {}) {
    return db.Payment.count({ where: { orderId, paymentMethod }, transaction });
  }

  // The most recent attempt that is still open and whose payment URL has not
  // expired yet. Spamming the pay button re-uses this instead of minting a new
  // gateway transaction on every click.
  findReusablePayment(orderId, paymentMethod, notBefore, { transaction } = {}) {
    return db.Payment.findOne({
      where: {
        orderId,
        paymentMethod,
        status: "PENDING",
        createdAt: { [Op.gte]: notBefore },
      },
      order: [["createdAt", "DESC"]],
      transaction,
    });
  }

  // Any attempt on this order that already went through, other than the one
  // being settled — the signal that the customer was charged twice.
  findSettledPaymentForOrder(orderId, excludePaymentId, { transaction } = {}) {
    return db.Payment.findOne({
      where: {
        orderId,
        status: "SUCCESS",
        ...(excludePaymentId ? { id: { [Op.ne]: excludePaymentId } } : {}),
      },
      transaction,
    });
  }

  updatePayment(payment, changes, { transaction } = {}) {
    return payment.update(changes, { transaction });
  }

  updateOrder(order, changes, { transaction } = {}) {
    return order.update(changes, { transaction });
  }

  createStatusHistory(data, { transaction } = {}) {
    return db.OrderStatusHistory.create(data, { transaction });
  }

  findVariantForUpdate(variantId, productId, { transaction }) {
    return db.ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  findProductForUpdate(productId, { transaction }) {
    return db.Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
  }

  incrementProductSoldCount(product, quantity, { transaction }) {
    return product.increment("soldCount", { by: quantity, transaction });
  }
}

module.exports = new PaymentRepository();
