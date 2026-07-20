module.exports = (sequelize, DataTypes) => {
  const AiMessage = sequelize.define(
    "AiMessage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "ai_conversations", key: "id" },
        onDelete: "CASCADE",
      },
      role: {
        type: DataTypes.ENUM("USER", "ASSISTANT", "SYSTEM", "TOOL"),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      structuredData: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      modelName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 },
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 },
      },
    },
    {
      tableName: "ai_messages",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["conversation_id"] }, { fields: ["role"] }],
    },
  );

  AiMessage.associate = (models) => {
    AiMessage.belongsTo(models.AiConversation, { foreignKey: "conversationId", as: "conversation" });
    AiMessage.belongsToMany(models.Product, {
      through: models.AiRecommendedProduct,
      foreignKey: "messageId",
      otherKey: "productId",
      as: "recommendedProducts",
    });
  };

  return AiMessage;
};
