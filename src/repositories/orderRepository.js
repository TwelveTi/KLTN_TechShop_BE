const { Op } = require("sequelize");
const db = require("../models");

// Data-access for customer orders: the read used by "my orders", plus every
// write that order creation needs (address, stock, order rows, cart cleanup).
class OrderRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  findAllByUserWithItems(userId, { transaction } = {}) {
    return db.Order.findAll({
      where: { userId },
      include: [
        {
          model: db.OrderItem,
          as: "items",
          attributes: [
            "id",
            "productName",
            "productSku",
            "productImageUrl",
            "variantName",
            "unitPrice",
            "quantity",
            "totalPrice",
          ],
        },
        {
          model: db.UserAddress,
          as: "address",
          attributes: ["id", "receiverName", "receiverPhone", "province", "district", "ward", "addressLine"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      transaction,
    });
  }

  /**
   * `lock` là thứ làm cho chốt trạng thái ở `cancelMyOrder` thật sự có hiệu lực.
   *
   * Không có nó, hai lượt huỷ đồng thời đều đọc được `status = "PENDING"` rồi đều
   * đi qua chốt, và mỗi lượt lại hoàn tồn kho thêm một lần — `order.update()` là
   * một `UPDATE` vô điều kiện, nó không hề kiểm lại trạng thái đã đọc.
   * `paymentService.createVnpayUrl` khoá đúng như thế này ở đường tương đương.
   */
  findOrderByIdForUser(orderId, userId, { transaction, lock } = {}) {
    return db.Order.findOne({
      where: { id: orderId, userId },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  findOrderByIdWithItems(orderId, { transaction } = {}) {
    return db.Order.findByPk(orderId, {
      include: [
        {
          model: db.OrderItem,
          as: "items",
          // Deterministic order so the stock-restore path takes its row locks
          // in the same sequence order creation does, which is what keeps a
          // cancel running next to a checkout from deadlocking.
          separate: true,
          order: [
            ["productId", "ASC"],
            ["variantId", "ASC"],
          ],
        },
        {
          model: db.UserAddress,
          as: "address",
          attributes: ["id", "receiverName", "receiverPhone", "province", "district", "ward", "addressLine"],
          required: false,
        },
      ],
      transaction,
    });
  }

  // ── Order code ────────────────────────────────────────────────────────────

  // Counts every order created on the given local day, soft-deleted ones
  // included: `orders.order_code` is UNIQUE at the database level, and a
  // paranoid delete leaves the row (and its code) in place.
  countOrdersCreatedBetween(startAt, endAt, { transaction } = {}) {
    return db.Order.count({
      where: { createdAt: { [Op.gte]: startAt, [Op.lt]: endAt } },
      paranoid: false,
      transaction,
    });
  }

  // ── Idempotency ───────────────────────────────────────────────────────────

  findIdempotency(userId, idempotencyKey, { transaction } = {}) {
    return db.OrderIdempotency.findOne({ where: { userId, idempotencyKey }, transaction });
  }

  createIdempotency(data, { transaction } = {}) {
    return db.OrderIdempotency.create(data, { transaction });
  }

  // ── Checkout reads ────────────────────────────────────────────────────────

  findAddressForUser(addressId, userId, { transaction } = {}) {
    return db.UserAddress.findOne({ where: { id: addressId, userId }, transaction });
  }

  // Locked reads: the row stays locked until the transaction commits, so two
  // shoppers racing for the last unit are serialized instead of overselling.
  // Deliberately no `include` — a locking read joined to product_images would
  // lock the image rows too, so images are fetched separately below.
  findProductForUpdate(productId, { transaction }) {
    return db.Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  findVariantForUpdate(variantId, productId, { transaction }) {
    return db.ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  findImagesForProduct(productId, { transaction } = {}) {
    return db.ProductImage.findAll({ where: { productId }, transaction });
  }

  findImagesForVariant(variantId, { transaction } = {}) {
    return db.ProductImage.findAll({ where: { variantId }, transaction });
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  decrementProductStock(product, quantity, { transaction }) {
    return product.decrement("stockQuantity", { by: quantity, transaction });
  }

  decrementVariantStock(variant, quantity, { transaction }) {
    return variant.decrement("stockQuantity", { by: quantity, transaction });
  }

  incrementProductStock(product, quantity, { transaction }) {
    return product.increment("stockQuantity", { by: quantity, transaction });
  }

  incrementVariantStock(variant, quantity, { transaction }) {
    return variant.increment("stockQuantity", { by: quantity, transaction });
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  createOrder(data, { transaction }) {
    return db.Order.create(data, { transaction });
  }

  createOrderItems(items, { transaction }) {
    return db.OrderItem.bulkCreate(items, { transaction });
  }

  createStatusHistory(data, { transaction }) {
    return db.OrderStatusHistory.create(data, { transaction });
  }

  createPayment(data, { transaction }) {
    return db.Payment.create(data, { transaction });
  }

  updateOrder(order, changes, { transaction }) {
    return order.update(changes, { transaction });
  }

  // ── Cart cleanup ──────────────────────────────────────────────────────────

  findCartByUser(userId, { transaction, lock } = {}) {
    return db.Cart.findOne({
      where: { userId },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  // Removes only the lines that were actually ordered — checkout supports a
  // partial selection, so the rest of the cart must survive.
  destroyCartItems(cartId, lines, { transaction }) {
    if (!cartId || lines.length === 0) {
      return Promise.resolve(0);
    }

    return db.CartItem.destroy({
      where: {
        cartId,
        [Op.or]: lines.map(({ productId, variantId }) => ({
          productId,
          variantId: variantId || null,
        })),
      },
      transaction,
    });
  }
}

module.exports = new OrderRepository();
