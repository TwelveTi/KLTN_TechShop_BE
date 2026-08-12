const db = require("../models");

// Data-access for carts, cart items, and the product/variant reads the cart
// needs to validate and price a line.
class CartRepository {
  beginTransaction() {
    return db.sequelize.transaction();
  }

  findCartByUser(userId, { transaction, lock } = {}) {
    return db.Cart.findOne({
      where: { userId },
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }

  createCart(userId, { transaction } = {}) {
    return db.Cart.create({ userId }, { transaction });
  }

  // Cart with every field needed to price it (items → product/variant → images).
  findCartWithItemsByUser(userId, { transaction } = {}) {
    return db.Cart.findOne({
      where: { userId },
      include: [
        {
          model: db.CartItem,
          as: "items",
          separate: true,
          order: [["createdAt", "ASC"]],
          include: [
            {
              model: db.Product,
              as: "product",
              include: [{ model: db.ProductImage, as: "images" }],
            },
            {
              model: db.ProductVariant,
              as: "variant",
              include: [{ model: db.ProductImage, as: "images" }],
            },
          ],
        },
      ],
      transaction,
    });
  }

  findProductById(productId, { transaction } = {}) {
    return db.Product.findByPk(productId, { transaction });
  }

  findVariant(variantId, productId, { transaction } = {}) {
    return db.ProductVariant.findOne({ where: { id: variantId, productId }, transaction });
  }

  findItem(cartId, productId, variantId, { transaction } = {}) {
    return db.CartItem.findOne({
      where: { cartId, productId, variantId: variantId || null },
      transaction,
    });
  }

  findItemById(itemId, cartId, { transaction } = {}) {
    return db.CartItem.findOne({ where: { id: itemId, cartId }, transaction });
  }

  createItem(data, { transaction } = {}) {
    return db.CartItem.create(data, { transaction });
  }

  updateItem(item, changes, { transaction } = {}) {
    return item.update(changes, { transaction });
  }

  destroyItemById(itemId, cartId, { transaction } = {}) {
    return db.CartItem.destroy({ where: { id: itemId, cartId }, transaction });
  }

  clearItems(cartId, { transaction } = {}) {
    return db.CartItem.destroy({ where: { cartId }, transaction });
  }
}

module.exports = new CartRepository();
