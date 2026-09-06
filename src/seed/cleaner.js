const db = require("../models");

/**
 * Safely cleans / truncates development database tables
 */
async function cleanDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE RESET IS FORBIDDEN IN PRODUCTION ENVIRONMENT!");
  }

  console.log("  Cleaning existing development data...");

  // Con trước, cha sau. TRUNCATE chạy với FOREIGN_KEY_CHECKS off nên
  // ON DELETE CASCADE không bao giờ bắn — bảng nào bỏ sót ở đây sẽ để lại
  // những dòng trỏ vào id đã biến mất. Kiểm chứng: trước khi bổ sung danh sách
  // này, 331/331 dòng `product_similarities` mồ côi sau một lượt seed, và bộ
  // gợi ý vẫn đọc chúng.
  const tables = [
    // AI
    "ai_recommended_products",
    "ai_messages",
    "ai_conversations",

    // Recommender: ma trận similarity và mọi thứ sinh ra từ hành vi. Phải xoá
    // cùng lúc với products/users, nếu không `npm run simulate` sẽ đo trên một
    // nửa dữ liệu cũ mà không có dấu hiệu gì báo.
    "recommendation_items",
    "recommendation_results",
    "product_similarities",
    "user_preference_profiles",
    "user_behaviors",
    "search_histories",

    // Các bảng phụ trợ tham chiếu users/orders.
    //
    // `discounts` CỐ Ý không có trong danh sách: nó không tham chiếu bảng nào bị
    // xoá ở đây, và không seeder nào tạo lại nó — thêm vào là mỗi lượt seed lại
    // xoá sạch voucher đã tạo tay để thử luồng checkout. Chỉ `discount_usages`
    // phải đi, vì nó trỏ tới users và orders.
    "discount_usages",
    "order_idempotency_keys",
    "otp_verifications",

    "reviews",
    "payments",
    "order_status_histories",
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "wishlist_items",
    "wishlists",
    "product_tags",
    "product_specifications",
    "specification_definitions",
    "product_images",
    "product_variants",
    "products",
    "tags",
    "brands",
    "categories",
    "user_addresses",
    "refresh_tokens",
    "auth_providers",
    "users",
  ];

  await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");

  for (const table of tables) {
    try {
      await db.sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
    } catch (error) {
      // If table doesn't exist yet, it's fine
    }
  }

  await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");

  console.log("    Database tables truncated successfully.");
}

module.exports = { cleanDatabase };
