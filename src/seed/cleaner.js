const db = require("../models");

/**
 * Safely cleans / truncates development database tables
 */
async function cleanDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE RESET IS FORBIDDEN IN PRODUCTION ENVIRONMENT!");
  }

  console.log("  Cleaning existing development data...");

  const tables = [
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
