module.exports = (sequelize, DataTypes) => {
  const ProductSimilarity = sequelize.define(
    "ProductSimilarity",
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
      similarProductId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      similarityType: {
        type: DataTypes.ENUM("CONTENT", "BEHAVIOR", "HYBRID"),
        allowNull: false,
      },
      score: {
        type: DataTypes.DECIMAL(8, 6),
        allowNull: false,
        validate: { min: 0, max: 1 },
      },
      calculatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "product_similarities",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        {
          name: "uq_prod_similarity",
          unique: true,
          fields: ["product_id", "similar_product_id", "similarity_type"],
        },
      ],
    },
  );

  ProductSimilarity.associate = (models) => {
    ProductSimilarity.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    ProductSimilarity.belongsTo(models.Product, { foreignKey: "similarProductId", as: "similarProduct" });
  };

  return ProductSimilarity;
};
