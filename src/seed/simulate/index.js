require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const db = require("../../models");
const { buildSimulationPlan } = require("./planner");

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

const parseArgs = (argv) => {
  const args = { users: 60, days: 90, seed: 42, reset: false, keep: false };

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
    console.log(
      `Removed simulated data: ${removed.users} users, ${removed.behaviors} behaviours, ` +
        `${removed.searches} searches, ${removed.profiles} profiles.`,
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
      attributes: ["id", "name", "categoryId", "brandId", "basePrice", "salePrice"],
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

  console.log(`\nGenerated (seed ${args.seed}, ${args.days} days):`);
  console.log(`  ${created.length} simulated shoppers`);
  console.log(`  ${behaviorRows.length} behaviour events  (${byType})`);
  console.log(`  ${searchRows.length} search history rows`);
  console.log(`  ground truth -> ${path.relative(process.cwd(), GROUND_TRUTH_FILE)}`);

  const conversion = plan.stats.PURCHASE / Math.max(plan.stats.VIEW_PRODUCT, 1);
  console.log(`  view -> purchase conversion: ${(conversion * 100).toFixed(1)}%`);
};

main()
  .catch((error) => {
    console.error("Simulation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
