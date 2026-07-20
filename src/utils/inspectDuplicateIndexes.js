const db = require("../models");

const inspectDuplicateIndexes = async () => {
  const databaseName = process.env.DB_NAME;

  const indexes = await db.sequelize.query(
    `
      SELECT
        table_name AS tableName,
        index_name AS indexName,
        non_unique AS nonUnique,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns
      FROM information_schema.statistics
      WHERE table_schema = :databaseName
      GROUP BY table_name, index_name, non_unique
      ORDER BY table_name, columns, index_name
    `,
    {
      replacements: { databaseName },
      type: db.Sequelize.QueryTypes.SELECT,
    },
  );

  const grouped = indexes.reduce((result, index) => {
    const key = `${index.tableName}:${index.nonUnique}:${index.columns}`;
    result[key] = result[key] || [];
    result[key].push(index);
    return result;
  }, {});

  const duplicates = Object.values(grouped).filter((items) => items.length > 1);

  console.log(JSON.stringify(duplicates, null, 2));
  await db.sequelize.close();
};

inspectDuplicateIndexes().catch(async (error) => {
  console.error(error);
  await db.sequelize.close();
  process.exit(1);
});
