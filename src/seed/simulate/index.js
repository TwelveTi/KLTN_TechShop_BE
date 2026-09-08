require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const db = require("../../models");
const { buildSimulationPlan } = require("./planner");
const counters = require("./counters");

/**
 * Generates a synthetic behaviour dataset for evaluating the recommender.
 *
 *   node src/seed/simulate/index.js --users=60 --days=90 --seed=42
 *   node src/seed/simulate/index.js --reset          # remove simulated data only
 *
 * Simulated shoppers live on their own email domain so they can always be told
 * apart from real accounts, and removed without touching anything else. They
 * have no credentials — they are data, not accounts, and cannot be logged into.
 */
const SIM_DOMAIN = "@sim.techshop.dev";
const GROUND_TRUTH_FILE = path.join(__dirname, "ground-truth.json");
const CHUNK = 500;

/**
 * 120 khách, không phải 60.
 *
 * Roster có 7 archetype (xem `planner.js`), và chương Đánh giá phải đọc được số
 * theo TỪNG archetype — toàn bộ luận điểm "khách khác nhau cần thành phần khác
 * nhau" biến mất trong một con số tổng. Ở 60 khách thì nhóm nhỏ nhất còn 6 người,
 * mỗi ca sai đổi kết quả nhóm đó 17 điểm. Ở 120 thì nhóm nhỏ nhất là 12.
 *
 * Nới quy mô ở đây không tốn gì: chỉ là một tham số của bộ sinh.
 */
const parseArgs = (argv) => {
  const args = { users: 120, days: 90, seed: 42, reset: false, keep: false };

  argv.slice(2).forEach((raw) => {
    if (raw === "--reset") {
      args.reset = true;
      return;
    }
    if (raw === "--keep") {
      args.keep = true;
      return;
    }
    const match = raw.match(/^--(users|days|seed)=(\d+)$/);
    if (match) {
      args[match[1]] = Number(match[2]);
    }
  });

  return args;
};

const removeSimulatedData = async () => {
  const simUsers = await db.User.findAll({
    where: { email: { [Op.like]: `%${SIM_DOMAIN}` } },
    attributes: ["id"],
    paranoid: false,
  });
  const ids = simUsers.map((u) => u.id);

  if (ids.length === 0) {
    return { users: 0, behaviors: 0, searches: 0, profiles: 0 };
  }

  const behaviors = await db.UserBehavior.destroy({ where: { userId: ids } });
  const searches = await db.SearchHistory.destroy({ where: { userId: ids } });
  const profiles = await db.UserPreferenceProfile.destroy({ where: { userId: ids } });
  const users = await db.User.destroy({ where: { id: ids }, force: true });

  return { users, behaviors, searches, profiles };
};

const insertInChunks = async (model, rows) => {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await model.bulkCreate(rows.slice(i, i + CHUNK));
  }
};


const main = async () => {
  const args = parseArgs(process.argv);

  await db.sequelize.authenticate();

  if (args.reset) {
    const removed = await removeSimulatedData();
    // Đếm lượt xem/bán cũng là dữ liệu mô phỏng đã ghi đè lên catalogue, nên
    // `--reset` phải trả nốt chúng về — nếu không thì "xoá sạch dữ liệu mô phỏng"
    // là lời hứa chỉ giữ được một nửa.
    const restored = await counters.restoreAuthored();
    console.log(
      `Removed simulated data: ${removed.users} users, ${removed.behaviors} behaviours, ` +
        `${removed.searches} searches, ${removed.profiles} profiles.`,
    );
    console.log(
      `Restored catalogue counters on ${restored.restored} products` +
        `${restored.untouched > 0 ? ` (${restored.untouched} not in products.data.js, left alone)` : ""}.`,
    );
    return;
  }

  // Re-running should replace the previous dataset, not stack a second one on
  // top of it — otherwise the numbers in the thesis stop being reproducible.
  if (!args.keep) {
    const removed = await removeSimulatedData();
    if (removed.users > 0) {
      console.log(`Cleared a previous run: ${removed.users} users, ${removed.behaviors} behaviours.`);
    }
  }

  const [products, categories, brands] = await Promise.all([
    db.Product.findAll({
      where: { status: "ACTIVE" },
      // `slug` được `buildSimulationPlan` dùng làm khoá sắp xếp tất định. Không
      // có nó thì planner rơi về thứ tự UUID và cùng một seed sẽ cho ra bộ dữ
      // liệu khác nhau sau mỗi lượt `seed:catalog` — xem chú thích ở planner.
      attributes: ["id", "slug", "name", "categoryId", "brandId", "basePrice", "salePrice"],
      order: [["slug", "ASC"]],
      raw: true,
    }),
    db.Category.findAll({ attributes: ["id", "name"], raw: true }),
    db.Brand.findAll({ attributes: ["id", "name"], raw: true }),
  ]);

  console.log(
    `Catalogue: ${products.length} active products, ${categories.length} categories, ${brands.length} brands.`,
  );

  const plan = buildSimulationPlan({
    products,
    categories,
    brands,
    users: args.users,
    days: args.days,
    seed: args.seed,
  });

  // Create the shoppers first so the events have real user ids to point at.
  const userRows = plan.personas.map((persona, index) => ({
    email: `sim.${persona.key.toLowerCase()}${SIM_DOMAIN}`,
    fullName: `Sim ${persona.key}`,
    phone: `09${String(700000000 + index).slice(0, 9)}`,
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
  }));

  const created = await db.User.bulkCreate(userRows, { returning: true });
  const idByPersona = new Map(plan.personas.map((persona, index) => [persona.key, created[index].id]));

  const behaviorRows = plan.behaviors.map(({ personaKey, ...row }) => ({
    ...row,
    userId: idByPersona.get(personaKey),
  }));
  const searchRows = plan.searches.map(({ personaKey, ...row }) => ({
    ...row,
    userId: idByPersona.get(personaKey),
  }));

  await insertInChunks(db.UserBehavior, behaviorRows);
  await insertInChunks(db.SearchHistory, searchRows);

  // Đưa catalogue về đúng thế giới mà persona vừa sống trong đó. Phải chạy SAU
  // khi hành vi đã nằm trong DB, vì hàm này tính lại từ DB chứ không từ `plan`.
  const simUserIds = [...idByPersona.values()];
  const written = await counters.recomputeFromEvents(simUserIds, products.map((p) => p.id));

  // The answer key, written to disk rather than into the database: it must not
  // sit anywhere the recommender could read it, because recovering it is
  // exactly what the evaluation measures.
  const groundTruth = {
    generatedAt: new Date().toISOString(),
    seed: args.seed,
    users: args.users,
    days: args.days,
    personas: plan.personas.map((persona) => ({
      userId: idByPersona.get(persona.key),
      key: persona.key,
      type: persona.type,
      truth: persona.truth,
    })),
  };
  fs.writeFileSync(GROUND_TRUTH_FILE, JSON.stringify(groundTruth, null, 2));

  const byType = Object.entries(plan.stats)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${type}=${count}`)
    .join(" · ");

  const byArchetype = plan.personas.reduce((acc, persona) => {
    acc[persona.type] = (acc[persona.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`\nGenerated (seed ${args.seed}, ${args.days} days):`);
  console.log(`  ${created.length} simulated shoppers`);
  console.log(
    `    ${Object.entries(byArchetype)
      .map(([type, n]) => `${type}=${n}`)
      .join(" · ")}`,
  );
  console.log(`  ${behaviorRows.length} behaviour events  (${byType})`);
  console.log(`  ${searchRows.length} search history rows`);
  console.log(`  ground truth -> ${path.relative(process.cwd(), GROUND_TRUTH_FILE)}`);

  const conversion = plan.stats.PURCHASE / Math.max(plan.stats.VIEW_PRODUCT, 1);
  console.log(`  view -> purchase conversion: ${(conversion * 100).toFixed(1)}%`);

  console.log(
    `\nCatalogue counters rewritten from these events (was: hand-authored in products.data.js):\n` +
      `  ${written.products} products touched · ${written.withViews} with views · ${written.withSales} with sales\n` +
      `  viewCount total ${written.views} · soldCount total ${written.sold} units\n` +
      `  \`npm run simulate:reset\` puts the authored numbers back.`,
  );
};

main()
  .catch((error) => {
    console.error("Simulation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
