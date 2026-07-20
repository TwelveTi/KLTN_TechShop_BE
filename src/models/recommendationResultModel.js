module.exports = (sequelize, DataTypes) => {
  const RecommendationResult = sequelize.define(
    "RecommendationResult",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      sessionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      recommendationType: {
        type: DataTypes.ENUM(
          "PERSONALIZED_HOME",
          "SIMILAR_PRODUCTS",
          "ALSO_VIEWED",
          "ALSO_BOUGHT",
          "CART_RECOMMENDATION",
          "AI_ADVISOR",
          "TRENDING",
        ),
        allowNull: false,
      },
      algorithmVersion: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      context: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "recommendation_results",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["user_id"] }, { fields: ["session_id"] }, { fields: ["recommendation_type"] }],
    },
  );

  RecommendationResult.associate = (models) => {
    RecommendationResult.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    RecommendationResult.hasMany(models.RecommendationItem, { foreignKey: "recommendationId", as: "items" });
  };

  return RecommendationResult;
};
