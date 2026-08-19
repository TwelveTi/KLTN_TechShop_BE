const discountService = require("../services/discountService");
const APIResponse = require("../utils/ApiResponse");

class DiscountController {
  // Checkout preview: tells the shopper what a code would take off. It reserves
  // nothing — the code can still run out before the order is placed, and order
  // creation stays the source of truth.
  async validateCode(req, res) {
    const result = await discountService.previewForUser(req.user.id, req.body.code, req.body.subtotal);

    return APIResponse.success(res, "Discount code applied successfully", result);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async getAllDiscounts(req, res) {
    const result = await discountService.getAll(req.query);

    return APIResponse.success(res, "Get discounts successfully", result);
  }

  async createDiscount(req, res) {
    const discount = await discountService.create(req.body);

    return APIResponse.success(res, "Discount created successfully", discount, 201);
  }

  async updateDiscount(req, res) {
    const discount = await discountService.update(req.params.id, req.body);

    return APIResponse.success(res, "Discount updated successfully", discount);
  }

  async deleteDiscount(req, res) {
    await discountService.remove(req.params.id);

    return APIResponse.success(res, "Discount deleted successfully");
  }
}

module.exports = new DiscountController();
