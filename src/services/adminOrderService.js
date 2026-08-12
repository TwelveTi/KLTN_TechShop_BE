const { Op } = require("sequelize");
const AppError = require("../utils/AppError");
const adminOrderRepository = require("../repositories/adminOrderRepository");

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID", "FAILED", "REFUNDED"];
// Once an order reaches one of these, its status is frozen for the admin console.
const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED"];

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
      const order = await adminOrderRepository.findOrderById(id, { transaction });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const fromStatus = order.status;

      if (fromStatus === status) {
        throw new AppError(`Order is already ${status}`, 409);
      }

      if (TERMINAL_STATUSES.includes(fromStatus)) {
        throw new AppError(`A ${fromStatus} order can no longer change status`, 409);
      }

      const updates = { status };
      // Keep the payment/timestamp side-effects consistent with the lifecycle.
      if (status === "CANCELLED" && !order.cancelledAt) {
        updates.cancelledAt = new Date();
      }
      if (status === "PAID" && !order.paidAt) {
        updates.paidAt = new Date();
        updates.paymentStatus = "PAID";
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
}

module.exports = new AdminOrderService();
