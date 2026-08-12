const { QueryTypes } = require("sequelize");
const db = require("../models");

// Data-access for admin revenue analytics. Owns the raw SQL (aggregations run in
// the database, not in application memory). The service keeps the date-range
// math and result formatting.
class AdminAnalyticsRepository {
  // Shared predicate: an order counts as revenue when it is PAID, not
  // cancelled/refunded, and its paid/created date is inside the window.
  paidOrderWhereSql(alias = "o") {
    return `
      ${alias}.payment_status = 'PAID'
      AND ${alias}.status NOT IN ('CANCELLED', 'REFUNDED')
      AND COALESCE(${alias}.paid_at, ${alias}.created_at) BETWEEN :startDate AND :endDate
    `;
  }

  select(sql, replacements) {
    return db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  }

  queryRevenueSummary(startDate, endDate) {
    return this.select(
      `
        SELECT
          COALESCE(SUM(o.total_price), 0) AS totalRevenue,
          COUNT(o.id) AS totalOrders,
          COALESCE(AVG(o.total_price), 0) AS averageOrderValue,
          COALESCE(SUM(o.discount_amount), 0) AS totalDiscount,
          COALESCE(SUM(o.shipping_fee), 0) AS totalShippingFee
        FROM orders o
        WHERE ${this.paidOrderWhereSql("o")}
      `,
      { startDate, endDate },
    );
  }

  queryOrderStatusCounts(startDate, endDate) {
    return this.select(
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
      { startDate, endDate },
    );
  }

  queryDailyRevenue(startDate, endDate) {
    return this.select(
      `
        SELECT
          DATE(COALESCE(o.paid_at, o.created_at)) AS date,
          COALESCE(SUM(o.total_price), 0) AS revenue,
          COUNT(o.id) AS orders
        FROM orders o
        WHERE ${this.paidOrderWhereSql("o")}
        GROUP BY DATE(COALESCE(o.paid_at, o.created_at))
        ORDER BY date ASC
      `,
      { startDate, endDate },
    );
  }

  queryMonthlyRevenue(startDate, endDate) {
    return this.select(
      `
        SELECT
          MONTH(COALESCE(o.paid_at, o.created_at)) AS month,
          COALESCE(SUM(o.total_price), 0) AS revenue,
          COUNT(o.id) AS orders
        FROM orders o
        WHERE ${this.paidOrderWhereSql("o")}
        GROUP BY MONTH(COALESCE(o.paid_at, o.created_at))
        ORDER BY month ASC
      `,
      { startDate, endDate },
    );
  }

  queryTopProducts(startDate, endDate, limit) {
    return this.select(
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
        WHERE ${this.paidOrderWhereSql("o")}
        GROUP BY oi.product_id, oi.product_name, oi.product_sku, oi.product_image_url
        ORDER BY revenue DESC, soldQuantity DESC
        LIMIT :limit
      `,
      { startDate, endDate, limit },
    );
  }

  queryRevenueByCategory(startDate, endDate) {
    return this.select(
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
        WHERE ${this.paidOrderWhereSql("o")}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `,
      { startDate, endDate },
    );
  }

  queryRevenueByBrand(startDate, endDate) {
    return this.select(
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
        WHERE ${this.paidOrderWhereSql("o")}
        GROUP BY b.id, b.name
        ORDER BY revenue DESC
      `,
      { startDate, endDate },
    );
  }
}

module.exports = new AdminAnalyticsRepository();
