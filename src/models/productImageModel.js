module.exports = (sequelize, DataTypes) => {
  const ProductImage = sequelize.define(
    "ProductImage",
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
      variantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "product_variants", key: "id" },
        onDelete: "SET NULL",
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      publicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      altText: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "product_images",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
    },
  );

  ProductImage.associate = (models) => {
    ProductImage.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    ProductImage.belongsTo(models.ProductVariant, { foreignKey: "variantId", as: "variant" });
  };

  return ProductImage;
};
