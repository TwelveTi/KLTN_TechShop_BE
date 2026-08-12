const cartService = require("../services/cartService");
const APIResponse = require("../utils/ApiResponse");

class CartController {
  async getMyCart(req, res) {
    const cart = await cartService.getMyCart(req.user.id);

    return APIResponse.success(res, "Get cart successfully", cart);
  }

  async addItem(req, res) {
    const cart = await cartService.addItem(req.user.id, {
      productId: req.body.productId,
      variantId: req.body.variantId || null,
      quantity: req.body.quantity,
    });

    return APIResponse.success(res, "Item added to cart successfully", cart, 201);
  }

  async updateItem(req, res) {
    const cart = await cartService.updateItem(req.user.id, req.params.itemId, {
      quantity: req.body.quantity,
    });

    return APIResponse.success(res, "Cart item updated successfully", cart);
  }

  async removeItem(req, res) {
    const cart = await cartService.removeItem(req.user.id, req.params.itemId);

    return APIResponse.success(res, "Cart item removed successfully", cart);
  }

  async clearCart(req, res) {
    const cart = await cartService.clearCart(req.user.id);

    return APIResponse.success(res, "Cart cleared successfully", cart);
  }
}

module.exports = new CartController();
