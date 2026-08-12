const db = require("../models");

// Data-access for customer orders.
class OrderRepository {
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
}

module.exports = new OrderRepository();
