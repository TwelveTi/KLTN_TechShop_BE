const { QueryTypes } = require("sequelize");
const db = require("../models");

class AdminAnalyticsService {
  getDateRange(query = {}) {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate ? new Date(query.startDate) : new Date(endDate);

    if (!query.startDate) {
      startDate.setDate(startDate.getDate() - 30);
    }

    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
  }

  getPaidOrderWhereSql(alias = "o") {
    return `
      ${alias}.payment_status = 'PAID'
      AND ${alias}.status NOT IN ('CANCELLED', 'REFUNDED')
      AND COALESCE(${alias}.paid_at, ${alias}.created_at) BETWEEN :startDate AND :endDate
    `;
  }

  async getRevenueSummary(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const [summary] = await db.sequelize.query(
      `
        SELECT
          COALESCE(SUM(o.total_price), 0) AS totalRevenue,
          COUNT(o.id) AS totalOrders,
          COALESCE(AVG(o.total_price), 0) AS averageOrderValue,
          COALESCE(SUM(o.discount_amount), 0) AS totalDiscount,
          COALESCE(SUM(o.shipping_fee), 0) AS totalShippingFee
        FROM orders o
        WHERE ${this.getPaidOrderWhereSql("o")}
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    const [orderStatus] = await db.sequelize.query(
      `
        SELECT
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pendingOrders,
          COUNT(CASE WHEN status = 'SHIPPING' THEN 1 END) AS shippingOrders,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) AS deliveredOrders,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelledOrders,
          COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) AS refundedOrders
        FROM orders
        WHERE created_at BETWEEN :startDate AND :endDate
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    return {
      startDate,
      endDate,
      totalRevenue: Number(summary.totalRevenue || 0),
      totalOrders: Number(summary.totalOrders || 0),
      averageOrderValue: Number(summary.averageOrderValue || 0),
      totalDiscount: Number(summary.totalDiscount || 0),
      totalShippingFee: Number(summary.totalShippingFee || 0),
      orderStatus: {
        pending: Number(orderStatus.pendingOrders || 0),
        shipping: Number(orderStatus.shippingOrders || 0),
        delivered: Number(orderStatus.deliveredOrders || 0),
        cancelled: Number(orderStatus.cancelledOrders || 0),
        refunded: Number(orderStatus.refundedOrders || 0),
      },
    };
  }

  async getDailyRevenue(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const rows = await db.sequelize.query(
      `
        SELECT
          DATE(COALESCE(o.paid_at, o.created_at)) AS date,
          COALESCE(SUM(o.total_price), 0) AS revenue,
          COUNT(o.id) AS orders
        FROM orders o
        WHERE ${this.getPaidOrderWhereSql("o")}
        GROUP BY DATE(COALESCE(o.paid_at, o.created_at))
        ORDER BY date ASC
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
    }));
  }

  async getMonthlyRevenue(query = {}) {
    const year = Number(query.year) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const rows = await db.sequelize.query(
      `
        SELECT
          MONTH(COALESCE(o.paid_at, o.created_at)) AS month,
          COALESCE(SUM(o.total_price), 0) AS revenue,
          COUNT(o.id) AS orders
        FROM orders o
        WHERE ${this.getPaidOrderWhereSql("o")}
        GROUP BY MONTH(COALESCE(o.paid_at, o.created_at))
        ORDER BY month ASC
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    const revenueByMonth = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      revenue: 0,
      orders: 0,
    }));

    rows.forEach((row) => {
      const monthIndex = Number(row.month) - 1;
      revenueByMonth[monthIndex] = {
        month: Number(row.month),
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0),
      };
    });

    return {
      year,
      items: revenueByMonth,
    };
  }

  async getTopProducts(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

    const rows = await db.sequelize.query(
      `
        SELECT
          oi.product_id AS productId,
          oi.product_name AS productName,
          oi.product_sku AS productSku,
          oi.product_image_url AS productImageUrl,
          COALESCE(SUM(oi.quantity), 0) AS soldQuantity,
          COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${this.getPaidOrderWhereSql("o")}
        GROUP BY oi.product_id, oi.product_name, oi.product_sku, oi.product_image_url
        ORDER BY revenue DESC, soldQuantity DESC
        LIMIT :limit
      `,
      {
        replacements: { startDate, endDate, limit },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      productImageUrl: row.productImageUrl,
      soldQuantity: Number(row.soldQuantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }

  async getRevenueByCategory(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const rows = await db.sequelize.query(
      `
        SELECT
          c.id AS categoryId,
          c.name AS categoryName,
          COALESCE(SUM(oi.quantity), 0) AS soldQuantity,
          COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${this.getPaidOrderWhereSql("o")}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName || "Unknown",
      soldQuantity: Number(row.soldQuantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }

  async getRevenueByBrand(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const rows = await db.sequelize.query(
      `
        SELECT
          b.id AS brandId,
          b.name AS brandName,
          COALESCE(SUM(oi.quantity), 0) AS soldQuantity,
          COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE ${this.getPaidOrderWhereSql("o")}
        GROUP BY b.id, b.name
        ORDER BY revenue DESC
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      brandId: row.brandId,
      brandName: row.brandName || "Unknown",
      soldQuantity: Number(row.soldQuantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }
}

module.exports = new AdminAnalyticsService();
