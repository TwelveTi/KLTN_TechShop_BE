require("dotenv").config();

const db = require("../models");
const { cleanDatabase } = require("./cleaner");
const { seedUsers } = require("./seeders/userSeeder");
const { seedTaxonomy } = require("./seeders/taxonomySeeder");
const { seedProducts } = require("./seeders/productSeeder");
const { seedCartAndWishlist } = require("./seeders/cartWishlistSeeder");
const { seedOrders } = require("./seeders/orderSeeder");
const { seedReviews } = require("./seeders/reviewSeeder");
const { seedBehaviors, buildPreferenceProfiles } = require("./seeders/behaviorSeeder");

/**
 * Runner for the modular catalogue seed under `src/seed/seeders/`.
 *
 * Those seeders and their data files existed but nothing ever imported them:
 * `npm run seed` runs `src/seed/index.js`, which carries its own inline dataset
 * and hardcodes every specification as STRING. This file is the missing entry
 * point, so the typed specifications in `data/specs.data.js` — the ones the AI
 * grounding pipeline queries by `value_number` — actually reach the database.
 *
 * DESTRUCTIVE: `cleanDatabase()` TRUNCATEs 22 tables, including `users`. Unlike
 * `src/seed/index.js`, which only deletes rows it created itself, this wipes
 * hand-made accounts and test orders too. Development only.
 */

// Order matters: taxonomy needs nothing, products need taxonomy, orders need
// products, reviews need the order items they attach to, and the behaviour log
// is derived from all four (orders, cart, wishlist, reviews) so it runs last.
async function seedAll() {
  return db.sequelize.transaction(async (transaction) => {
    const userMap = await seedUsers(transaction);
    const taxonomies = await seedTaxonomy(transaction);
    const { productMap, variantMap } = await seedProducts(taxonomies, transaction);
    await seedCartAndWishlist(userMap, productMap, variantMap, transaction);
    const { orderItemMap } = await seedOrders(userMap, productMap, variantMap, transaction);
    await seedReviews(userMap, productMap, orderItemMap, transaction);
    return seedBehaviors(userMap, productMap, transaction);
  });
}

// The point of this seed is that measurable specs arrive as numbers, so the
// summary reports that directly rather than a bare row count.
async function reportTypedSpecs() {
  const [rows] = await db.sequelize.query(`
    SELECT c.name AS category, d.spec_key AS spec, d.data_type, d.unit,
           COUNT(ps.id) AS rows_total,
           SUM(ps.value_number IS NOT NULL) AS typed_number,
           SUM(ps.value_boolean IS NOT NULL) AS typed_boolean,
           MIN(ps.value_number) AS min_value,
           MAX(ps.value_number) AS max_value
    FROM (
      SELECT id, category_id, \`key\` AS spec_key, data_type, unit, sort_order
      FROM specification_definitions
      WHERE data_type <> 'STRING'
    ) d
    JOIN categories c ON c.id = d.category_id
    LEFT JOIN product_specifications ps ON ps.specification_definition_id = d.id
    GROUP BY d.id
    ORDER BY c.name, d.sort_order
  `);

  const [untyped] = await db.sequelize.query(`
    SELECT COUNT(*) AS n
    FROM product_specifications ps
    JOIN specification_definitions d ON d.id = ps.specification_definition_id
    WHERE d.data_type = 'NUMBER' AND ps.value_number IS NULL
  `);

  const [noDisplay] = await db.sequelize.query(
    "SELECT COUNT(*) AS n FROM product_specifications WHERE value_text IS NULL",
  );

  console.log("\n  Typed specifications:");
  console.table(rows);
  console.log(`  NUMBER specs without a number : ${untyped[0].n}`);
  console.log(`  Specs missing display text    : ${noDisplay[0].n}`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Catalogue seed is disabled in production.");
  }

  console.log(`  Seeding catalogue into database "${process.env.DB_NAME}"`);
  console.log("  This TRUNCATEs all catalogue, user and order tables first.");

  await db.sequelize.authenticate();
  await db.sequelize.sync();
  await cleanDatabase();
  const { behaviorUserIds } = await seedAll();

  // Sau commit, không sớm hơn: `recomputeProfile` dùng truy vấn riêng nên bên
  // trong transaction nó chưa thấy dòng hành vi nào và sẽ ghi ra hồ sơ rỗng.
  await buildPreferenceProfiles(behaviorUserIds);

  const counts = {};
  for (const [name, model] of Object.entries({
    users: db.User,
    categories: db.Category,
    brands: db.Brand,
    products: db.Product,
    product_variants: db.ProductVariant,
    specification_definitions: db.SpecificationDefinition,
    product_specifications: db.ProductSpecification,
    orders: db.Order,
    order_items: db.OrderItem,
    reviews: db.Review,
    user_behaviors: db.UserBehavior,
    search_histories: db.SearchHistory,
    user_preference_profiles: db.UserPreferenceProfile,
  })) {
    counts[name] = await model.count();
  }

  console.log("\n  Row counts:");
  console.table(counts);
  await reportTypedSpecs();
}

main()
  .catch((error) => {
    console.error("Catalogue seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
