// The shape of an order returned by the checkout endpoints.
//
// Sequelize hands DECIMAL columns back as strings (MySQL preserves the exact
// scale), which the frontend types declare as `number`. Rather than leaving
// every caller to coerce, the money is converted once here.
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOrderItem = (item) => ({
  id: item.id,
  productId: item.productId,
  variantId: item.variantId,
  productName: item.productName,
  productSku: item.productSku,
  productImageUrl: item.productImageUrl,
  variantName: item.variantName,
  variantAttributes: item.variantAttributes,
  unitPrice: toNumber(item.unitPrice),
  quantity: item.quantity,
  totalPrice: toNumber(item.totalPrice),
});

const toOrder = (order) => {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    shippingAddress: order.shippingAddress,
    subtotalPrice: toNumber(order.subtotalPrice),
    shippingFee: toNumber(order.shippingFee),
    discountAmount: toNumber(order.discountAmount),
    totalPrice: toNumber(order.totalPrice),
    note: order.note,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    items: (order.items || []).map(toOrderItem),
  };
};

module.exports = { toOrder, toOrderItem };
