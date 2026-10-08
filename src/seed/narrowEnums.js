// Thu hẹp ENUM của database đang chạy cho khớp với model, vì `sync()` không sửa cột đã có.
// Mặc định chỉ đếm; thêm `--apply` để sửa thật.
require("dotenv").config();

const db = require("../models");

const COLUMNS = [
  { table: "payments", column: "payment_method", keep: ["COD", "VNPAY"], remap: { MOMO: "VNPAY", STRIPE: "VNPAY" } },
  { table: "auth_providers", column: "provider", keep: ["LOCAL", "GOOGLE"], remap: {} },
  { table: "ai_conversations", column: "conversation_type", keep: ["PRODUCT_ADVISOR", "PRODUCT_COMPARISON"], remap: {} },
];

const quoteList = (values) => values.map((v) => `'${v}'`).join(", ");

async function countOutside({ table, column, keep }) {
  const [rows] = await db.sequelize.query(
    `SELECT \`${column}\` AS value, COUNT(*) AS total FROM \`${table}\` WHERE \`${column}\` NOT IN (${quoteList(keep)}) GROUP BY \`${column}\``,
  );
  return rows;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Không chạy script này trên production.");
  }

  const apply = process.argv.includes("--apply");
  await db.sequelize.authenticate();

  // Dòng không có cách đổi an toàn thì dừng, không tự xoá dữ liệu người dùng.
  for (const spec of COLUMNS) {
    const outside = await countOutside(spec);
    console.log(`${spec.table}.${spec.column}:`, outside.length ? outside : "sạch");

    const blocked = outside.filter((row) => !spec.remap[row.value]);
    if (blocked.length) {
      throw new Error(`${spec.table} còn giá trị không đổi được: ${blocked.map((r) => r.value).join(", ")}`);
    }
  }

  const [notes] = await db.sequelize.query(
    "SELECT COUNT(*) AS total FROM `order_status_histories` WHERE `note` LIKE '%MoMo%'",
  );
  console.log("order_status_histories nhắc MoMo:", Number(notes[0].total));

  if (!apply) {
    console.log("Chạy thử xong. Thêm --apply để sửa thật.");
    return;
  }

  for (const { table, column, keep, remap } of COLUMNS) {
    for (const [from, to] of Object.entries(remap)) {
      await db.sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = '${to}' WHERE \`${column}\` = '${from}'`);
    }
    await db.sequelize.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ENUM(${quoteList(keep)}) NOT NULL`);
    console.log(`Đã thu hẹp ${table}.${column}`);
  }

  await db.sequelize.query(
    "UPDATE `order_status_histories` SET `note` = REPLACE(`note`, 'MoMo', 'VNPay') WHERE `note` LIKE '%MoMo%'",
  );
  console.log("Xong.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
