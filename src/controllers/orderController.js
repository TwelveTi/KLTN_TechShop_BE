const orderService = require("../services/orderService");
const APIResponse = require("../utils/ApiResponse");

class OrderController {
  async getMyOrders(req, res) {
    const result = await orderService.getMyOrders(req.user.id);

    return APIResponse.success(res, "Get my orders successfully", result);
  }
}

module.exports = new OrderController();
