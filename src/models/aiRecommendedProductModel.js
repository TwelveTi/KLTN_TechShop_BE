module.exports = (sequelize, DataTypes) => {
  const AiRecommendedProduct = sequelize.define(
    "AiRecommendedProduct",
    {
      messageId: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: "ai_messages", key: "id" },
        onDelete: "CASCADE",
      },
      productId: {
        type: DataTypes.UUID,
        primaryKey: true,
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
        allowNull: true,
        validate: { min: 0 },
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "ai_recommended_products",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
    },
  );

  return AiRecommendedProduct;
};
