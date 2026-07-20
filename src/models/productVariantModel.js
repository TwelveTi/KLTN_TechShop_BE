module.exports = (sequelize, DataTypes) => {
  const ProductVariant = sequelize.define(
    "ProductVariant",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      sku: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      variantName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      attributes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
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
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE", "OUT_OF_STOCK"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "product_variants",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [{ fields: ["product_id"] }, { fields: ["status"] }],
    },
  );

  ProductVariant.associate = (models) => {
    ProductVariant.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    ProductVariant.hasMany(models.ProductImage, { foreignKey: "variantId", as: "images" });
    ProductVariant.hasMany(models.CartItem, { foreignKey: "variantId", as: "cartItems" });
    ProductVariant.hasMany(models.WishlistItem, { foreignKey: "variantId", as: "wishlistItems" });
    ProductVariant.hasMany(models.OrderItem, { foreignKey: "variantId", as: "orderItems" });
  };

  return ProductVariant;
};
