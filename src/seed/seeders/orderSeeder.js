const db = require("../../models");
const ordersData = require("../data/orders.data");

/**
 * Seeds Orders, OrderItems, OrderStatusHistories, and Payments
 */
async function seedOrders(userMap, productMap, variantMap, transaction) {
  console.log("  Seeding Orders, OrderItems, StatusHistories, and Payments...");

  const createdOrders = [];
  const orderItemMap = new Map(); // key: `${orderCode}_${productKey}` -> orderItem

  for (const item of ordersData) {
    const user = userMap.get(item.userKey);
    if (!user) continue;

    const userAddresses = await db.UserAddress.findAll({ where: { userId: user.id }, transaction });
    const defaultAddress = userAddresses.find((a) => a.isDefault) || userAddresses[0];

    const shippingAddressText = defaultAddress
      ? `${defaultAddress.addressLine}, ${defaultAddress.ward}, ${defaultAddress.district}, ${defaultAddress.province}`
      : "Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh";

    const receiverName = defaultAddress ? defaultAddress.receiverName : user.fullName;
    const receiverPhone = defaultAddress ? defaultAddress.receiverPhone : (user.phone || "0901234567");

    // Calculate subtotal
    let subtotalPrice = 0;
    const orderItemsToCreate = [];

    for (const orderItem of item.items) {
      const product = productMap.get(orderItem.productKey);
      const variant = variantMap.get(orderItem.variantSku);

      if (!product) continue;

      const unitPrice = orderItem.unitPrice;
      const quantity = orderItem.quantity;
      const totalPrice = unitPrice * quantity;
      subtotalPrice += totalPrice;

      orderItemsToCreate.push({
        productId: product.id,
        variantId: variant?.id || null,
        productName: product.name,
        productSku: variant?.sku || product.sku || null,
        productImageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&auto=format&fit=crop&q=80",
        variantName: variant?.variantName || null,
        variantAttributes: variant?.attributes || null,
        unitPrice,
        quantity,
        totalPrice,
        productKey: orderItem.productKey,
      });
    }

    const shippingFee = item.shippingFee || 0;
    const discountAmount = item.discountAmount || 0;
    const totalPrice = Math.max(0, subtotalPrice + shippingFee - discountAmount);

    const order = await db.Order.create(
      {
        orderCode: item.orderCode,
        userId: user.id,
        addressId: defaultAddress?.id || null,
        receiverName,
        receiverPhone,
        shippingAddress: shippingAddressText,
        subtotalPrice,
        shippingFee,
        discountAmount,
        totalPrice,
        status: item.status,
        paymentStatus: item.paymentStatus,
        note: item.note || null,
        paidAt: item.paidAt || null,
        cancelledAt: item.cancelledAt || null,
        createdAt: item.createdAt,
        updatedAt: item.paidAt || item.createdAt,
      },
      { transaction },
    );

    createdOrders.push(order);

    // Create OrderItems
    for (const oi of orderItemsToCreate) {
      const createdItem = await db.OrderItem.create(
        {
          orderId: order.id,
          productId: oi.productId,
          variantId: oi.variantId,
          productName: oi.productName,
          productSku: oi.productSku,
          productImageUrl: oi.productImageUrl,
          variantName: oi.variantName,
          variantAttributes: oi.variantAttributes,
          unitPrice: oi.unitPrice,
          quantity: oi.quantity,
          totalPrice: oi.totalPrice,
          createdAt: item.createdAt,
        },
        { transaction },
      );

      orderItemMap.set(`${item.orderCode}_${oi.productKey}`, createdItem);
    }

    // Create OrderStatusHistory
    if (Array.isArray(item.history) && item.history.length > 0) {
      for (const h of item.history) {
        const historyDate = new Date(item.createdAt.getTime() + (h.offsetMinutes || 0) * 60 * 1000);
        await db.OrderStatusHistory.create(
          {
            orderId: order.id,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            note: h.note || null,
            changedBy: user.id,
            createdAt: historyDate,
          },
          { transaction },
        );
      }
    }

    // Create Payment
    let paymentStatus = "PENDING";
    if (item.paymentStatus === "PAID") paymentStatus = "SUCCESS";
    else if (item.paymentStatus === "REFUNDED") paymentStatus = "REFUNDED";
    else if (item.paymentStatus === "FAILED") paymentStatus = "FAILED";

    await db.Payment.create(
      {
        orderId: order.id,
        paymentMethod: item.paymentMethod || "COD",
        amount: totalPrice,
        status: paymentStatus,
        transactionCode: item.paymentStatus === "PAID" ? `TXN-${item.orderCode}` : null,
        paidAt: item.paidAt || null,
        createdAt: item.createdAt,
        updatedAt: item.paidAt || item.createdAt,
      },
      { transaction },
    );
  }

  console.log(`    Created ${createdOrders.length} Orders with OrderItems, StatusHistories, and Payments.`);
  return { createdOrders, orderItemMap };
}

module.exports = { seedOrders };
