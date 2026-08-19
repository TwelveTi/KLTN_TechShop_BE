const Sequelize = require("sequelize");
const sequelize = require("../configs/database");

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require("./userModel")(sequelize, Sequelize.DataTypes);
db.AuthProvider = require("./authProviderModel")(sequelize, Sequelize.DataTypes);
db.RefreshToken = require("./refreshTokenModel")(sequelize, Sequelize.DataTypes);
db.OtpVerification = require("./otpVerificationModel")(sequelize, Sequelize.DataTypes);
db.UserAddress = require("./userAddressModel")(sequelize, Sequelize.DataTypes);

db.Category = require("./categoryModel")(sequelize, Sequelize.DataTypes);
db.Brand = require("./brandModel")(sequelize, Sequelize.DataTypes);
db.Product = require("./productModel")(sequelize, Sequelize.DataTypes);
db.ProductImage = require("./productImageModel")(sequelize, Sequelize.DataTypes);
db.ProductVariant = require("./productVariantModel")(sequelize, Sequelize.DataTypes);
db.SpecificationDefinition = require("./specificationDefinitionModel")(sequelize, Sequelize.DataTypes);
db.ProductSpecification = require("./productSpecificationModel")(sequelize, Sequelize.DataTypes);
db.Tag = require("./tagModel")(sequelize, Sequelize.DataTypes);
db.ProductTag = require("./productTagModel")(sequelize, Sequelize.DataTypes);

db.Cart = require("./cartModel")(sequelize, Sequelize.DataTypes);
db.CartItem = require("./cartItemModel")(sequelize, Sequelize.DataTypes);
db.Wishlist = require("./wishlistModel")(sequelize, Sequelize.DataTypes);
db.WishlistItem = require("./wishlistItemModel")(sequelize, Sequelize.DataTypes);

db.Order = require("./orderModel")(sequelize, Sequelize.DataTypes);
db.OrderItem = require("./orderItemModel")(sequelize, Sequelize.DataTypes);
db.OrderStatusHistory = require("./orderStatusHistoryModel")(sequelize, Sequelize.DataTypes);
db.OrderIdempotency = require("./orderIdempotencyModel")(sequelize, Sequelize.DataTypes);
db.Payment = require("./paymentModel")(sequelize, Sequelize.DataTypes);
db.Discount = require("./discountModel")(sequelize, Sequelize.DataTypes);
db.DiscountUsage = require("./discountUsageModel")(sequelize, Sequelize.DataTypes);
db.Review = require("./reviewModel")(sequelize, Sequelize.DataTypes);

db.SearchHistory = require("./searchHistoryModel")(sequelize, Sequelize.DataTypes);
db.UserBehavior = require("./userBehaviorModel")(sequelize, Sequelize.DataTypes);
db.UserPreferenceProfile = require("./userPreferenceProfileModel")(sequelize, Sequelize.DataTypes);
db.ProductSimilarity = require("./productSimilarityModel")(sequelize, Sequelize.DataTypes);
db.RecommendationResult = require("./recommendationResultModel")(sequelize, Sequelize.DataTypes);
db.RecommendationItem = require("./recommendationItemModel")(sequelize, Sequelize.DataTypes);

db.AiConversation = require("./aiConversationModel")(sequelize, Sequelize.DataTypes);
db.AiMessage = require("./aiMessageModel")(sequelize, Sequelize.DataTypes);
db.AiRecommendedProduct = require("./aiRecommendedProductModel")(sequelize, Sequelize.DataTypes);

Object.keys(db).forEach((modelName) => {
  if (db[modelName] && db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
