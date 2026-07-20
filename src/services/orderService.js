const db = require("../models");

class OrderService {
  async getMyOrders(userId) {
    const orders = await db.Order.findAll({
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
    });

    const statusSummary = orders.reduce((summary, order) => {
      summary[order.status] = (summary[order.status] || 0) + 1;
      return summary;
    }, {});

    return {
      statusSummary,
      orders,
    };
  }
}

module.exports = new OrderService();
