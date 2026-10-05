// Dựng app trên một database test riêng cho từng file test, xoá sạch rồi tạo lại.
// Chỉ chạy khi tên DB kết thúc bằng `_test`, để không bao giờ xoá nhầm DB thật.
const mysql = require("mysql2/promise");

async function startTestApi(suiteName) {
  require("dotenv").config();

  // Mỗi file test chạy trong tiến trình riêng và song song, nên mỗi file một DB.
  const dbName = `${process.env.TEST_DB_PREFIX || "techshop"}_${suiteName}_test`;
  if (!dbName.endsWith("_test")) {
    throw new Error(`Từ chối chạy test trên database "${dbName}"`);
  }

  process.env.DB_NAME = dbName;
  process.env.NODE_ENV = "test";
  process.env.KAFKA_ENABLED = "false";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await connection.query(`CREATE DATABASE \`${dbName}\``);
  await connection.end();

  // Nạp sau khi đã đặt biến môi trường, vì configs/database.js đọc DB_NAME lúc require.
  const db = require("../../src/models");
  const app = require("../../src/app");

  await db.sequelize.sync();

  return { app, db };
}

// Tạo khách đã xác thực email + một địa chỉ thẳng trong DB, rồi đăng nhập qua API lấy token.
async function createCustomer(app, db, email, { verified = true, password = "secret123" } = {}) {
  const request = require("supertest");
  const userService = require("../../src/services/userService");

  const user = await userService.provisionUser({
    email,
    password,
    fullName: email.split("@")[0],
    emailVerifiedAt: verified ? new Date() : null,
  });
  const address = await db.UserAddress.create({
    userId: user.id,
    receiverName: "Nguyen Van An",
    receiverPhone: "0901234567",
    province: "TP Ho Chi Minh",
    district: "Quan 1",
    ward: "Ben Nghe",
    addressLine: "1 Le Loi",
    isDefault: true,
  });
  const login = await request(app).post("/api/v1/auth/login").send({ email, password });

  return { user, addressId: address.id, token: login.body.data.accessToken };
}

module.exports = { startTestApi, createCustomer };
