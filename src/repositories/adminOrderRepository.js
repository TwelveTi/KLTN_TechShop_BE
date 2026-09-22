const db = require("../models");

// Data-access for the admin order console. Kept 1:1 with adminOrderService so
// the service never touches the ORM directly.
class AdminOrderRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  // Paginated order list. `items` and `statusHistories` are loaded with
  // `separate: true` so the hasMany joins never multiply rows (keeping the
  // pagination count correct) and are batched into one extra query each.
  findAndCountOrders({ where, limit, offset }) {
    return db.Order.findAndCountAll({
      where,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "phone"], required: false },
        {
          model: db.UserAddress,
          as: "address",
          attributes: ["id", "receiverName", "receiverPhone", "province", "district", "ward", "addressLine"],
          required: false,
        },
        {
          model: db.OrderItem,
          as: "items",
          attributes: [
            "id",
            "productId",
            "variantId",
            "productName",
            "productSku",
            "productImageUrl",
            "variantName",
            "unitPrice",
            "quantity",
            "totalPrice",
          ],
          separate: true,
        },
        {
          model: db.OrderStatusHistory,
          as: "statusHistories",
          attributes: ["id", "fromStatus", "toStatus", "note", "createdAt"],
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  findOrderByIdWithRelations(id) {
    return db.Order.findByPk(id, {
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "phone"], required: false },
        {
          model: db.UserAddress,
          as: "address",
          attributes: ["id", "receiverName", "receiverPhone", "province", "district", "ward", "addressLine"],
          required: false,
        },
        {
          model: db.OrderItem,
          as: "items",
          attributes: [
            "id",
            "productId",
            "variantId",
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
          model: db.OrderStatusHistory,
          as: "statusHistories",
          attributes: ["id", "fromStatus", "toStatus", "note", "createdAt"],
          separate: true,
          order: [["createdAt", "ASC"]],
          include: [{ model: db.User, as: "changer", attributes: ["id", "fullName"], required: false }],
        },
      ],
    });
  }

  findOrderById(id, { transaction } = {}) {
    return db.Order.findByPk(id, { transaction });
  }

  updateOrder(order, updates, { transaction } = {}) {
    return order.update(updates, { transaction });
  }

  createStatusHistory(data, { transaction } = {}) {
    return db.OrderStatusHistory.create(data, { transaction });
  }

  // ── Stock release ─────────────────────────────────────────────────────────
  // Cancelling an order hands its reserved units back to the catalogue.

  findOrderItems(orderId, { transaction } = {}) {
    return db.OrderItem.findAll({
      where: { orderId },
      attributes: ["id", "productId", "variantId", "quantity"],
      // Same ordering order creation uses, so a cancel and a concurrent
      // checkout take their row locks in the same sequence and cannot deadlock.
      order: [
        ["productId", "ASC"],
        ["variantId", "ASC"],
      ],
      transaction,
    });
  }

  findProductForUpdate(productId, { transaction }) {
    return db.Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
  }

  findVariantForUpdate(variantId, productId, { transaction }) {
    return db.ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  incrementProductStock(product, quantity, { transaction }) {
    return product.increment("stockQuantity", { by: quantity, transaction });
  }

  incrementVariantStock(variant, quantity, { transaction }) {
    return variant.increment("stockQuantity", { by: quantity, transaction });
  }
}

module.exports = new AdminOrderRepository();
