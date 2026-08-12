const adminAnalyticsRepository = require("../repositories/adminAnalyticsRepository");

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

  async getRevenueSummary(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const [summary] = await adminAnalyticsRepository.queryRevenueSummary(startDate, endDate);
    const [orderStatus] = await adminAnalyticsRepository.queryOrderStatusCounts(startDate, endDate);

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

    const rows = await adminAnalyticsRepository.queryDailyRevenue(startDate, endDate);

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

    const rows = await adminAnalyticsRepository.queryMonthlyRevenue(startDate, endDate);

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

    const rows = await adminAnalyticsRepository.queryTopProducts(startDate, endDate, limit);

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

    const rows = await adminAnalyticsRepository.queryRevenueByCategory(startDate, endDate);

    return rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName || "Unknown",
      soldQuantity: Number(row.soldQuantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }

  async getRevenueByBrand(query = {}) {
    const { startDate, endDate } = this.getDateRange(query);

    const rows = await adminAnalyticsRepository.queryRevenueByBrand(startDate, endDate);

    return rows.map((row) => ({
      brandId: row.brandId,
      brandName: row.brandName || "Unknown",
      soldQuantity: Number(row.soldQuantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }
}

module.exports = new AdminAnalyticsService();
