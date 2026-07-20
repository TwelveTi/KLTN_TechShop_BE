module.exports = (sequelize, DataTypes) => {
  const RecommendationItem = sequelize.define(
    "RecommendationItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      recommendationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "recommendation_results", key: "id" },
        onDelete: "CASCADE",
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      rankPosition: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      score: {
        type: DataTypes.DECIMAL(12, 6),
        allowNull: false,
        validate: { min: 0 },
      },
      reasonCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      reasonMetadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      clickedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      addedToCartAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      purchasedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "recommendation_items",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: "uq_recommendation_product", unique: true, fields: ["recommendation_id", "product_id"] },
      ],
    },
  );

  RecommendationItem.associate = (models) => {
    RecommendationItem.belongsTo(models.RecommendationResult, {
      foreignKey: "recommendationId",
      as: "recommendation",
    });
    RecommendationItem.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
  };

  return RecommendationItem;
};
