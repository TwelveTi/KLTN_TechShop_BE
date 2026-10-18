const { Op } = require("sequelize");
const AppError = require("../utils/AppError");
const adminOrderRepository = require("../repositories/adminOrderRepository");
const productRepository = require("../repositories/productRepository");
const discountService = require("./discountService");

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID", "FAILED", "REFUNDED"];
// Trạng thái chỉ đi tới, không lùi. Đơn đã giao, đã huỷ, đã hoàn tiền thì đóng băng.
// FE giữ một bản sao ở AdminOrdersPage, sửa ở đây phải sửa kèm bên đó.
const ALLOWED_TRANSITIONS = {
  PENDING: ["PAID", "PROCESSING", "CANCELLED"],
  PAID: ["PROCESSING", "REFUNDED"],
  PROCESSING: ["SHIPPING", "CANCELLED", "REFUNDED"],
  SHIPPING: ["DELIVERED", "CANCELLED", "REFUNDED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

class AdminOrderService {
  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  buildPagedResult(rows, count, page, limit) {
    return {
      items: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  // Filters operate on columns of the orders table only (indexed status/payment
  // plus a LIKE on order code / receiver), so the list query stays simple.
  buildWhere(query) {
    const where = {};

    if (query.status && ORDER_STATUSES.includes(query.status)) {
      where.status = query.status;
    }

    if (query.paymentStatus && PAYMENT_STATUSES.includes(query.paymentStatus)) {
      where.paymentStatus = query.paymentStatus;
    }

    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
      where[Op.or] = [
        { orderCode: { [Op.like]: `%${search}%` } },
        { receiverName: { [Op.like]: `%${search}%` } },
        { receiverPhone: { [Op.like]: `%${search}%` } },
      ];
    }

    return where;
  }

  async getAllOrders(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);
    const where = this.buildWhere(query);

    const { rows, count } = await adminOrderRepository.findAndCountOrders({ where, limit, offset });

    return this.buildPagedResult(rows, count, page, limit);
  }

  async getOrderById(id) {
    const order = await adminOrderRepository.findOrderByIdWithRelations(id);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    return order;
  }

  async updateOrderStatus(id, { status, note }, adminId) {
    if (!ORDER_STATUSES.includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const transaction = await adminOrderRepository.beginTransaction();

    try {
      // Khoá dòng để admin và khách cùng huỷ một đơn không hoàn kho, nhả voucher hai lần.
      const order = await adminOrderRepository.findOrderById(id, { transaction, lock: true });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const fromStatus = order.status;

      if (fromStatus === status) {
        throw new AppError(`Order is already ${status}`, 409);
      }

      if (!ALLOWED_TRANSITIONS[fromStatus].includes(status)) {
        throw new AppError(`A ${fromStatus} order cannot be moved to ${status}`, 409);
      }

      // Đơn đã thu tiền thì phải hoàn tiền chứ không huỷ; đơn chưa thu thì không có gì để hoàn.
      const isPaid = order.paymentStatus === "PAID";
      if (status === "CANCELLED" && isPaid) {
        throw new AppError("This order has been paid. Refund it instead of cancelling", 409);
      }
      if (status === "REFUNDED" && !isPaid) {
        throw new AppError("Only a paid order can be refunded", 409);
      }

      const updates = { status };

      if (status === "CANCELLED" || status === "REFUNDED") {
        // Kho đã giữ từ lúc đặt hàng nên huỷ hay hoàn tiền đều phải trả lại.
        await this.restoreStock(order.id, transaction);
      }
      if (status === "CANCELLED") {
        updates.cancelledAt = order.cancelledAt || new Date();
        // Cùng thứ tự khoá với lúc khách tự huỷ: sản phẩm trước, voucher sau.
        await discountService.releaseForOrder(order.id, transaction);
      }
      if (status === "REFUNDED") {
        updates.paymentStatus = "REFUNDED";
        await this.adjustSoldCount(order.id, -1, transaction);
      }

      // Admin xác nhận đã thu tiền, hoặc giao xong đơn COD (shipper thu tiền khi giao).
      // Thiếu bước này thì đơn COD giao xong vẫn "Chưa thanh toán", không vào doanh thu.
      if ((status === "PAID" || status === "DELIVERED") && !isPaid) {
        const paidAt = new Date();
        updates.paidAt = paidAt;
        updates.paymentStatus = "PAID";
        await adminOrderRepository.settlePendingPayments(order.id, paidAt, { transaction });
        await this.adjustSoldCount(order.id, 1, transaction);
      }

      await adminOrderRepository.updateOrder(order, updates, { transaction });

      await adminOrderRepository.createStatusHistory(
        {
          orderId: order.id,
          fromStatus,
          toStatus: status,
          note: note || null,
          changedBy: adminId || null,
        },
        { transaction },
      );

      await transaction.commit();

      return adminOrderRepository.findOrderByIdWithRelations(order.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Returns an order's reserved units to the product (or variant) they came
  // from. Lines whose product has since been deleted carry a NULL id — the FK
  // is ON DELETE SET NULL — and are skipped rather than failing the cancel.
  async restoreStock(orderId, transaction) {
    const items = await adminOrderRepository.findOrderItems(orderId, { transaction });

    for (const item of items) {
      if (item.variantId) {
        const variant = await adminOrderRepository.findVariantForUpdate(item.variantId, item.productId, {
          transaction,
        });

        if (variant) {
          await adminOrderRepository.incrementVariantStock(variant, item.quantity, { transaction });
          await productRepository.syncProductStockFromVariants(variant.productId, { transaction });
        }

        continue;
      }

      if (item.productId) {
        const product = await adminOrderRepository.findProductForUpdate(item.productId, { transaction });

        if (product) {
          await adminOrderRepository.incrementProductStock(product, item.quantity, { transaction });
        }
      }
    }
  }

  // soldCount chỉ đổi theo tiền thật: cộng khi đơn được thu tiền, trừ khi hoàn tiền.
  async adjustSoldCount(orderId, sign, transaction) {
    const items = await adminOrderRepository.findOrderItems(orderId, { transaction });

    for (const item of items) {
      if (!item.productId) continue;
      const product = await adminOrderRepository.findProductForUpdate(item.productId, { transaction });
      if (product) {
        await adminOrderRepository.incrementSoldCount(product, sign * item.quantity, { transaction });
      }
    }
  }
}

module.exports = new AdminOrderService();
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
