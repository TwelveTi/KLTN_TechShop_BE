const authRoute = require("./authRoute");
const productRoute = require("./productRoute");
const orderRoute = require("./orderRoute");
const addressRoute = require("./addressRoute");
const adminRoute = require("./adminRoute");
const {
  notFoundHandler,
  errorHandler,
} = require("../middlewares/errorHandler");

const API_PREFIX = "/api/v1";

function route(app) {
  app.use(API_PREFIX, authRoute);
  app.use(API_PREFIX, productRoute);
  app.use(API_PREFIX, orderRoute);
  app.use(API_PREFIX, addressRoute);
  app.use(API_PREFIX, adminRoute);
  app.use(notFoundHandler);
  app.use(errorHandler);
}

module.exports = route;
