const authRoute = require("./authRoute");
const userRoute = require("./userRoute");
const productRoute = require("./productRoute");
const catalogRoute = require("./catalogRoute");
const behaviorRoute = require("./behaviorRoute");
const recommendationRoute = require("./recommendationRoute");
const aiRoute = require("./aiRoute");
const reviewRoute = require("./reviewRoute");
const orderRoute = require("./orderRoute");
const paymentRoute = require("./paymentRoute");
const discountRoute = require("./discountRoute");
const cartRoute = require("./cartRoute");
const addressRoute = require("./addressRoute");
const adminRoute = require("./adminRoute");
const {
  notFoundHandler,
  errorHandler,
} = require("../middlewares/errorHandler");
const { mountDocs } = require("../docs");

const API_PREFIX = "/api/v1";

function route(app) {
  // Swagger UI ở `/api/docs`, spec thô ở `/api/docs.json`.
  mountDocs(app);

  app.use(API_PREFIX, authRoute);
  app.use(API_PREFIX, userRoute);
  app.use(API_PREFIX, productRoute);
  app.use(API_PREFIX, catalogRoute);
  app.use(API_PREFIX, behaviorRoute);
  app.use(API_PREFIX, recommendationRoute);
  app.use(API_PREFIX, aiRoute);
  app.use(API_PREFIX, reviewRoute);
  app.use(API_PREFIX, orderRoute);
  app.use(API_PREFIX, paymentRoute);
  app.use(API_PREFIX, discountRoute);
  app.use(API_PREFIX, cartRoute);
  app.use(API_PREFIX, addressRoute);
  app.use(API_PREFIX, adminRoute);
  app.use(notFoundHandler);
  app.use(errorHandler);
}

module.exports = route;
