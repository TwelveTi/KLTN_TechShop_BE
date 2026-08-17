const orderService = require("../services/orderService");
const APIResponse = require("../utils/ApiResponse");
const { toOrder } = require("../utils/orderSerializer");

class OrderController {
  async getMyOrders(req, res) {
    const result = await orderService.getMyOrders(req.user.id);

    return APIResponse.success(res, "Get my orders successfully", result);
  }

  async createOrder(req, res) {
    const { order, replayed } = await orderService.createOrder(req.user.id, req.body, req.idempotencyKey);

    // A replay is not a fresh creation, so it answers 200 rather than 201.
    return APIResponse.success(
      res,
      replayed ? "Order already placed" : "Order placed successfully",
      toOrder(order),
      replayed ? 200 : 201,
    );
  }

  async cancelMyOrder(req, res) {
    const order = await orderService.cancelMyOrder(req.user.id, req.params.id, req.body.reason);

    return APIResponse.success(res, "Order cancelled successfully", toOrder(order));
  }
}

module.exports = new OrderController();
