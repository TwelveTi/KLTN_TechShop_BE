const crypto = require("crypto");
const AppError = require("../utils/AppError");
const orderRepository = require("../repositories/orderRepository");
const discountService = require("./discountService");
const behaviorService = require("./behaviorService");
const pricing = require("../utils/pricing");

// Delivery options. The frontend renders these too, but the money that ends up
// on the order is always the value computed here — a client-sent fee is never
// trusted. Keep in sync with FE `features/checkout/lib/checkout.ts`.
const DELIVERY_METHODS = {
  standard: { id: "standard", name: "Standard delivery", fee: 30000 },
};
const DEFAULT_DELIVERY_METHOD_ID = "standard";
const FREE_SHIPPING_THRESHOLD = 1000000;

const PAYMENT_METHODS = ["COD", "VNPAY"];

// A pending order can still be cancelled by its owner; anything further along
// is the warehouse's / admin's call.
const CUSTOMER_CANCELLABLE_STATUSES = ["PENDING"];

// How many times to retry when two checkouts generate the same order code in
// the same second and the UNIQUE index rejects the loser.
const ORDER_CODE_MAX_ATTEMPTS = 5;

// Window over which a client that sent no Idempotency-Key still gets duplicate
// protection, by hashing the basket together with a time bucket of this size.
const FALLBACK_IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

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

  resolveDeliveryMethod(deliveryMethodId) {
    const method = DELIVERY_METHODS[deliveryMethodId || DEFAULT_DELIVERY_METHOD_ID];

    if (!method) {
      throw new AppError("Delivery method is not available", 400);
    }

    return method;
  }

  resolveShippingFee(subtotal, method) {
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : method.fee;
  }

  // "ORD-YYYYMMDD-NNN", matching the format already in the database. NNN is the
  // running count for the day; the caller retries on a unique-constraint clash.
  async generateOrderCode(now, { transaction }) {
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

    const countToday = await orderRepository.countOrdersCreatedBetween(startAt, endAt, { transaction });

    const datePart = [
      startAt.getFullYear(),
      String(startAt.getMonth() + 1).padStart(2, "0"),
      String(startAt.getDate()).padStart(2, "0"),
    ].join("");

    return `ORD-${datePart}-${String(countToday + 1).padStart(3, "0")}`;
  }

  formatAddress(address) {
    return [address.addressLine, address.ward, address.district, address.province]
      .filter(Boolean)
      .join(", ");
  }

  // Load one requested line, lock its stock row, and turn it into an immutable
  // order-item snapshot. Everything that decides money comes from the database.
  async buildOrderLine({ productId, variantId, quantity }, transaction) {
    const product = await orderRepository.findProductForUpdate(productId, { transaction });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (product.status !== "ACTIVE") {
      throw new AppError(`"${product.name}" is no longer available`, 409);
    }

    let variant = null;

    if (variantId) {
      variant = await orderRepository.findVariantForUpdate(variantId, productId, { transaction });

      if (!variant) {
        throw new AppError("Product variant not found", 404);
      }

      if (variant.status !== "ACTIVE") {
        throw new AppError(`"${product.name}" (${variant.variantName}) is no longer available`, 409);
      }
    }

    const stock = pricing.resolveStock(product, variant);

    if (stock <= 0) {
      throw new AppError(`"${product.name}" is out of stock`, 409);
    }

    if (quantity > stock) {
      throw new AppError(`Only ${stock} item(s) of "${product.name}" left in stock`, 409);
    }

    const { unitPrice } = pricing.resolveUnitPrice(product, variant);
    const totalPrice = pricing.roundMoney(unitPrice * quantity);

    const productImages = await orderRepository.findImagesForProduct(product.id, { transaction });
    const variantImages = variant
      ? await orderRepository.findImagesForVariant(variant.id, { transaction })
      : [];

    const imageUrl = pricing.resolveImageUrl(
      { ...product.get({ plain: true }), images: productImages },
      variant ? { ...variant.get({ plain: true }), images: variantImages } : null,
    );

    return {
      product,
      variant,
      quantity,
      unitPrice,
      totalPrice,
      // Snapshot: an order must keep showing what was bought even after the
      // product is renamed, repriced or deleted.
      snapshot: {
        productId: product.id,
        variantId: variant ? variant.id : null,
        productName: product.name,
        productSku: variant ? variant.sku : product.sku,
        productImageUrl: imageUrl,
        variantName: variant ? variant.variantName : null,
        variantAttributes: variant ? variant.attributes : null,
        unitPrice,
        quantity,
        totalPrice,
      },
    };
  }

  // Reject duplicate (productId, variantId) pairs instead of silently merging
  // them: a client sending the same line twice is a bug we want to surface.
  assertNoDuplicateLines(items) {
    const seen = new Set();

    items.forEach((item) => {
      const key = `${item.productId}::${item.variantId || ""}`;

      if (seen.has(key)) {
        throw new AppError("The same product appears more than once in the order", 400);
      }

      seen.add(key);
    });
  }

  // Clients are expected to send an `Idempotency-Key`; the storefront does. When
  // one is missing (a script, a manual curl) this derives a stand-in from the
  // basket itself so a burst of identical submits still collapses into a single
  // order instead of reserving the same stock several times over.
  //
  // Best-effort only: the time bucket means two identical submits landing on
  // opposite sides of a bucket boundary can still both go through. A real
  // client should send its own key.
  buildFallbackIdempotencyKey(userId, payload) {
    const material = JSON.stringify({
      addressId: payload.addressId,
      paymentMethod: payload.paymentMethod,
      deliveryMethodId: payload.deliveryMethodId || DEFAULT_DELIVERY_METHOD_ID,
      // Part of the key: the same basket with and without a voucher is two
      // different orders, and must not collapse into one.
      discountCode: payload.discountCode || null,
      items: [...payload.items]
        .map((item) => `${item.productId}:${item.variantId || ""}:${item.quantity}`)
        .sort(),
      bucket: Math.floor(Date.now() / FALLBACK_IDEMPOTENCY_WINDOW_MS),
    });

    const digest = crypto.createHash("sha256").update(`${userId}${material}`).digest("hex");

    return `auto-${digest.slice(0, 40)}`;
  }

  async createOrder(userId, payload, idempotencyKey) {
    const key = idempotencyKey || this.buildFallbackIdempotencyKey(userId, payload);

    // A replay of a completed checkout returns the original order rather than
    // creating (and charging for) a second one.
    const existing = await orderRepository.findIdempotency(userId, key);

    if (existing) {
      return {
        order: await orderRepository.findOrderByIdWithItems(existing.orderId),
        replayed: true,
      };
    }

    return this.createOrderWithRetry(userId, payload, key);
  }

  async createOrderWithRetry(userId, payload, idempotencyKey) {

    let lastError = null;

    for (let attempt = 0; attempt < ORDER_CODE_MAX_ATTEMPTS; attempt += 1) {
      try {
        return { order: await this.createOrderOnce(userId, payload, idempotencyKey), replayed: false };
      } catch (error) {
        if (error?.name !== "SequelizeUniqueConstraintError") {
          throw error;
        }

        // The other submit of this same key won the race and its order is now
        // committed. Hand that one back instead of surfacing a constraint error.
        if (idempotencyKey && this.isIdempotencyClash(error)) {
          const winner = await orderRepository.findIdempotency(userId, idempotencyKey);

          if (winner) {
            return {
              order: await orderRepository.findOrderByIdWithItems(winner.orderId),
              replayed: true,
            };
          }
        }

        // An order-code collision is the only case worth retrying: the code
        // comes from a per-day counter, so the next attempt reads a higher one.
        if (!this.isOrderCodeClash(error)) {
          throw error;
        }

        lastError = error;
      }
    }

    throw lastError;
  }

  // Sequelize reports the offending columns differently across dialects and
  // versions, so match on the raw index name too.
  clashedFields(error) {
    return [
      ...Object.keys(error.fields || {}),
      ...(error.errors || []).map((item) => item.path),
      error.parent?.sqlMessage || "",
    ].join(" ");
  }

  isOrderCodeClash(error) {
    return /order_?[cC]ode/.test(this.clashedFields(error));
  }

  isIdempotencyClash(error) {
    return /idempotency_?[kK]ey/.test(this.clashedFields(error));
  }

  async createOrderOnce(userId, payload, idempotencyKey) {
    const { addressId, paymentMethod, deliveryMethodId, note, items, discountCode } = payload;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new AppError("Payment method is not supported", 400);
    }

    this.assertNoDuplicateLines(items);

    const deliveryMethod = this.resolveDeliveryMethod(deliveryMethodId);
    const transaction = await orderRepository.beginTransaction();

    try {
      const address = await orderRepository.findAddressForUser(addressId, userId, { transaction });

      if (!address) {
        throw new AppError("Shipping address not found", 404);
      }

      // Lines are built (and their stock rows locked) in the order they were
      // sent. Sorting first keeps the lock order stable across concurrent
      // checkouts, which is what prevents deadlocks between two shoppers
      // buying the same two products in opposite order.
      const sortedItems = [...items].sort((a, b) =>
        `${a.productId}${a.variantId || ""}`.localeCompare(`${b.productId}${b.variantId || ""}`),
      );

      const lines = [];
      for (const item of sortedItems) {
        lines.push(await this.buildOrderLine(item, transaction));
      }

      const subtotalPrice = pricing.roundMoney(lines.reduce((sum, line) => sum + line.totalPrice, 0));

      // The voucher row is locked here, inside the same transaction that holds
      // the stock locks, so a usage-limited code cannot be over-redeemed by
      // concurrent checkouts. Locking AFTER the product rows keeps the lock
      // order the same everywhere (products -> discount), which is what stops a
      // cancel running next to a checkout from deadlocking.
      let discountAmount = 0;
      let appliedDiscount = null;

      if (discountCode) {
        appliedDiscount = await discountService.applyToOrder({
          code: discountCode,
          userId,
          subtotal: subtotalPrice,
          transaction,
        });
        discountAmount = appliedDiscount.discountAmount;
      }

      // Shipping is charged on the pre-discount subtotal: a voucher reduces what
      // is paid for goods, it does not buy free delivery. A FREESHIP code would
      // be its own discountType.
      const shippingFee = this.resolveShippingFee(subtotalPrice, deliveryMethod);
      const totalPrice = pricing.roundMoney(subtotalPrice + shippingFee - discountAmount);

      const orderCode = await this.generateOrderCode(new Date(), { transaction });

      const order = await orderRepository.createOrder(
        {
          orderCode,
          userId,
          addressId: address.id,
          receiverName: address.receiverName,
          receiverPhone: address.receiverPhone,
          shippingAddress: this.formatAddress(address),
          subtotalPrice,
          shippingFee,
          discountAmount,
          totalPrice,
          status: "PENDING",
          paymentStatus: "UNPAID",
          note: note || null,
        },
        { transaction },
      );

      await orderRepository.createOrderItems(
        lines.map((line) => ({ orderId: order.id, ...line.snapshot })),
        { transaction },
      );

      // Deferred until the order id exists. Writes the redemption row and bumps
      // the voucher's usedCount, both still under the lock taken above.
      if (appliedDiscount) {
        await appliedDiscount.commit(order.id);
      }

      // Stock is reserved at checkout, not at payment: the customer who
      // completed the form owns the units. It is returned on cancellation.
      for (const line of lines) {
        if (line.variant) {
          await orderRepository.decrementVariantStock(line.variant, line.quantity, { transaction });
        } else {
          await orderRepository.decrementProductStock(line.product, line.quantity, { transaction });
        }
      }

      await orderRepository.createStatusHistory(
        {
          orderId: order.id,
          fromStatus: null,
          toStatus: "PENDING",
          note: `Order placed (${paymentMethod})`,
          changedBy: userId,
        },
        { transaction },
      );

      // COD gets its payment row now. VNPAY creates one per attempt when the
      // payment URL is requested, because each attempt needs its own
      // gateway transaction reference.
      if (paymentMethod === "COD") {
        await orderRepository.createPayment(
          {
            orderId: order.id,
            paymentMethod: "COD",
            amount: totalPrice,
            status: "PENDING",
          },
          { transaction },
        );
      }

      if (idempotencyKey) {
        // Inside the transaction on purpose: the UNIQUE (user_id, key) index
        // makes a concurrent duplicate submit fail here and roll back the
        // whole order instead of creating a second one.
        await orderRepository.createIdempotency(
          { userId, idempotencyKey, orderId: order.id },
          { transaction },
        );
      }

      const cart = await orderRepository.findCartByUser(userId, { transaction, lock: true });

      if (cart) {
        await orderRepository.destroyCartItems(
          cart.id,
          lines.map((line) => ({ productId: line.product.id, variantId: line.variant?.id || null })),
          { transaction },
        );
      }

      await transaction.commit();

      // Recorded AFTER the commit, never inside the transaction: a tracking
      // failure must not roll back an order the customer has paid for.
      // PURCHASE is the heaviest signal the recommender has.
      await behaviorService.trackPurchase({
        userId,
        orderId: order.id,
        lines: lines.map((line) => ({
          productId: line.product.id,
          categoryId: line.product.categoryId || null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      });

      return orderRepository.findOrderByIdWithItems(order.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelMyOrder(userId, orderId, reason) {
    const transaction = await orderRepository.beginTransaction();

    try {
      // `lock: true` BẮT BUỘC. Hai lượt huỷ đồng thời (khách bấm đôi, hoặc FE thử
      // lại một request đã timeout) nếu đọc không khoá thì đều thấy `PENDING`,
      // đều đi qua chốt bên dưới, và mỗi lượt lại hoàn tồn kho cùng nhả voucher
      // thêm một lần. Khoá ở đây làm lượt thứ hai chờ, rồi đọc ra `CANCELLED` và
      // dừng ở đúng chốt đã có sẵn.
      const order = await orderRepository.findOrderByIdForUser(orderId, userId, {
        transaction,
        lock: true,
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.status === "CANCELLED") {
        throw new AppError("Order is already cancelled", 409);
      }

      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
        throw new AppError(`A ${order.status} order can no longer be cancelled`, 409);
      }

      const fromStatus = order.status;

      await orderRepository.updateOrder(
        order,
        { status: "CANCELLED", cancelledAt: new Date() },
        { transaction },
      );

      await this.restoreStockForOrder(order.id, transaction);

      // Same lock order as creation (products first, then the voucher) so a
      // cancel and a concurrent checkout cannot deadlock against each other.
      await discountService.releaseForOrder(order.id, transaction);

      await orderRepository.createStatusHistory(
        {
          orderId: order.id,
          fromStatus,
          toStatus: "CANCELLED",
          note: reason || "Cancelled by customer",
          changedBy: userId,
        },
        { transaction },
      );

      await transaction.commit();

      return orderRepository.findOrderByIdWithItems(order.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Puts the reserved units back. Lines whose product/variant has since been
  // deleted (the FK is ON DELETE SET NULL) are skipped rather than failing the
  // cancellation.
  async restoreStockForOrder(orderId, transaction) {
    const order = await orderRepository.findOrderByIdWithItems(orderId, { transaction });

    for (const item of order.items || []) {
      if (item.variantId) {
        const variant = await orderRepository.findVariantForUpdate(item.variantId, item.productId, {
          transaction,
        });

        if (variant) {
          await orderRepository.incrementVariantStock(variant, item.quantity, { transaction });
        }

        continue;
      }

      if (item.productId) {
        const product = await orderRepository.findProductForUpdate(item.productId, { transaction });

        if (product) {
          await orderRepository.incrementProductStock(product, item.quantity, { transaction });
        }
      }
    }
  }
}

module.exports = new OrderService();
