const orderRepository = require("../repositories/orderRepository");

class OrderService {
  async getMyOrders(userId) {
    const orders = await orderRepository.findAllByUserWithItems(userId);

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
