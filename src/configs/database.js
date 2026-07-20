// config/database.js
const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,     // database name
  process.env.DB_USER,     // username
  process.env.DB_PASSWORD, // password
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,         
    pool: {
      max: 5,       
      min: 0,        
      acquire: 30000, 
      idle: 10000     
    }
  }
);

module.exports = sequelize;