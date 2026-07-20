// utils/connectDB.js
const db = require("../models");

const connectDB = async () => {
  try {
    await db.sequelize.authenticate();
    await db.sequelize.sync();
  } catch (err) {
    console.error(" Lỗi kết nối database:", err);
    process.exit(1); // Dừng chương trình nếu lỗi
  }
};

module.exports = connectDB;
