const AppError = require("../utils/AppError");
const cartRepository = require("../repositories/cartRepository");
const pricing = require("../utils/pricing");
const behaviorService = require("./behaviorService");

// Cart pricing and stock are ALWAYS resolved from the database. Any price,
// subtotal or total sent by the frontend is ignored on purpose.
//
// The money/stock rules themselves live in utils/pricing so that order creation
// prices a line exactly the way the cart displayed it.
class CartService {
  toNumber(value) {
    return pricing.toNumber(value);
  }

  roundMoney(value) {
    return pricing.roundMoney(value);
  }

  resolveUnitPrice(product, variant) {
    return pricing.resolveUnitPrice(product, variant);
  }

  resolveStock(product, variant) {
    return pricing.resolveStock(product, variant);
  }

  resolveImageUrl(product, variant) {
    return pricing.resolveImageUrl(product, variant);
  }

  async getOrCreateCart(userId, transaction, { lock = false } = {}) {
    const cart = await cartRepository.findCartByUser(userId, { transaction, lock });

    if (cart) {
      return cart;
    }

    // Every user normally gets a cart at registration; this is a defensive
    // fallback (e.g. legacy accounts) so the cart endpoints never 500.
    return cartRepository.createCart(userId, { transaction });
  }

  // Build the FE-facing cart payload. Never trusts client-supplied money values.
  formatCart(cart) {
    const items = (cart.items || []).map((item) => {
      const product = item.product || null;
      const variant = item.variant || null;

      const pricing = this.resolveUnitPrice(product || {}, variant);
      const stock = product ? this.resolveStock(product, variant) : 0;
      const subtotal = this.roundMoney(pricing.unitPrice * item.quantity);

      const productActive = product ? product.status === "ACTIVE" : false;
      const variantActive = variant ? variant.status === "ACTIVE" : true;
      const isActive = productActive && variantActive;
      const inStock = stock >= item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId || null,
        name: product ? product.name : null,
        slug: product ? product.slug : null,
        variantName: variant ? variant.variantName : null,
        sku: variant ? variant.sku : product?.sku || null,
        imageUrl: this.resolveImageUrl(product, variant),
        basePrice: pricing.basePrice,
        salePrice: pricing.salePrice,
        unitPrice: pricing.unitPrice,
        quantity: item.quantity,
        subtotal,
        stock,
        inStock,
        isActive,
        // A line is purchasable only when the product/variant is active and
        // there is enough stock for the requested quantity.
        isAvailable: Boolean(product) && isActive && inStock,
      };
    });

    const subtotal = this.roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: cart.id,
      items,
      subtotal,
      totalItems,
      totalLines: items.length,
    };
  }

  // Fetch the authenticated user's cart with everything needed to price it.
  async getMyCart(userId) {
    const cart = await cartRepository.findCartWithItemsByUser(userId);

    if (!cart) {
      // No cart row yet: create one so the FE always gets a stable cart id.
      const created = await cartRepository.createCart(userId);
      return this.formatCart({ id: created.id, items: [] });
    }

    return this.formatCart(cart);
  }

  // Load and validate a product (and optional variant) for a mutating action.
  async loadPurchasable(productId, variantId, transaction) {
    const product = await cartRepository.findProductById(productId, { transaction });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (product.status !== "ACTIVE") {
      throw new AppError("Product is not available", 409);
    }

    let variant = null;

    if (variantId) {
      variant = await cartRepository.findVariant(variantId, productId, { transaction });

      if (!variant) {
        throw new AppError("Product variant not found", 404);
      }

      if (variant.status !== "ACTIVE") {
        throw new AppError("Product variant is not available", 409);
      }
    }

    return { product, variant };
  }

  async addItem(userId, { productId, variantId = null, quantity }) {
    const transaction = await cartRepository.beginTransaction();

    try {
      // Lock the cart row so concurrent add/update requests for the same user
      // are serialized (prevents duplicate lines / lost updates without Redis).
      const cart = await this.getOrCreateCart(userId, transaction, { lock: true });
      const { product, variant } = await this.loadPurchasable(productId, variantId, transaction);
      const stock = this.resolveStock(product, variant);

      const existingItem = await cartRepository.findItem(cart.id, productId, variantId, { transaction });

      const currentQuantity = existingItem ? existingItem.quantity : 0;
      const nextQuantity = currentQuantity + quantity;

      if (stock <= 0) {
        throw new AppError("Product is out of stock", 409);
      }

      if (nextQuantity > stock) {
        throw new AppError(`Only ${stock} item(s) left in stock`, 409);
      }

      if (existingItem) {
        // Product already in cart: increase quantity instead of duplicating.
        await cartRepository.updateItem(existingItem, { quantity: nextQuantity }, { transaction });
      } else {
        await cartRepository.createItem(
          {
            cartId: cart.id,
            productId,
            variantId: variantId || null,
            quantity,
          },
          { transaction },
        );
      }

      await transaction.commit();

      // Tracked after the commit: a strong intent signal, but not one worth
      // failing an add-to-cart over.
      await behaviorService.track({
        userId,
        behaviorType: "ADD_TO_CART",
        productId: product.id,
        categoryId: product.categoryId || null,
        metadata: { quantity, variantId: variantId || null },
      });

      return this.getMyCart(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateItem(userId, itemId, { quantity }) {
    const transaction = await cartRepository.beginTransaction();

    try {
      const cart = await this.getOrCreateCart(userId, transaction, { lock: true });

      const item = await cartRepository.findItemById(itemId, cart.id, { transaction });

      if (!item) {
        throw new AppError("Cart item not found", 404);
      }

      const { product, variant } = await this.loadPurchasable(item.productId, item.variantId, transaction);
      const stock = this.resolveStock(product, variant);

      if (stock <= 0) {
        throw new AppError("Product is out of stock", 409);
      }

      if (quantity > stock) {
        throw new AppError(`Only ${stock} item(s) left in stock`, 409);
      }

      await cartRepository.updateItem(item, { quantity }, { transaction });

      await transaction.commit();
      return this.getMyCart(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async removeItem(userId, itemId) {
    const transaction = await cartRepository.beginTransaction();

    try {
      const cart = await this.getOrCreateCart(userId, transaction, { lock: true });

      const deleted = await cartRepository.destroyItemById(itemId, cart.id, { transaction });

      if (deleted === 0) {
        throw new AppError("Cart item not found", 404);
      }

      await transaction.commit();
      return this.getMyCart(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async clearCart(userId) {
    const transaction = await cartRepository.beginTransaction();

    try {
      const cart = await this.getOrCreateCart(userId, transaction, { lock: true });
      await cartRepository.clearItems(cart.id, { transaction });
      await transaction.commit();
      return this.getMyCart(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new CartService();
