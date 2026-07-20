module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
        onDelete: "RESTRICT",
      },
      brandId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "brands", key: "id" },
        onDelete: "RESTRICT",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(280),
        allowNull: false,
        unique: true,
      },
      sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },
      shortDescription: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      basePrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      salePrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      stockQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      soldCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      viewCount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      averageRating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, max: 5 },
      },
      reviewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      status: {
        type: DataTypes.ENUM("DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"),
        allowNull: false,
        defaultValue: "DRAFT",
      },
      isFeatured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "products",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ["category_id"] },
        { fields: ["brand_id"] },
        { fields: ["status"] },
        { fields: ["base_price"] },
        { fields: ["created_at"] },
      ],
    },
  );

  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    Product.belongsTo(models.Brand, { foreignKey: "brandId", as: "brand" });
    Product.hasMany(models.ProductImage, { foreignKey: "productId", as: "images" });
    Product.hasMany(models.ProductVariant, { foreignKey: "productId", as: "variants" });
    Product.hasMany(models.ProductSpecification, { foreignKey: "productId", as: "specifications" });
    Product.belongsToMany(models.Tag, {
      through: models.ProductTag,
      foreignKey: "productId",
      otherKey: "tagId",
      as: "tags",
    });
    Product.hasMany(models.CartItem, { foreignKey: "productId", as: "cartItems" });
    Product.hasMany(models.WishlistItem, { foreignKey: "productId", as: "wishlistItems" });
    Product.hasMany(models.OrderItem, { foreignKey: "productId", as: "orderItems" });
    Product.hasMany(models.Review, { foreignKey: "productId", as: "reviews" });
    Product.hasMany(models.SearchHistory, { foreignKey: "productId", as: "searchHistories" });
    Product.hasMany(models.UserBehavior, { foreignKey: "productId", as: "behaviors" });
    Product.hasMany(models.ProductSimilarity, { foreignKey: "productId", as: "similarities" });
    Product.hasMany(models.ProductSimilarity, { foreignKey: "similarProductId", as: "similarToProducts" });
    Product.hasMany(models.RecommendationItem, { foreignKey: "productId", as: "recommendationItems" });
    Product.belongsToMany(models.AiMessage, {
      through: models.AiRecommendedProduct,
      foreignKey: "productId",
      otherKey: "messageId",
      as: "aiMessages",
    });
  };

  return Product;
};
