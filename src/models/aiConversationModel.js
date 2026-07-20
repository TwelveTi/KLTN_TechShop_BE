module.exports = (sequelize, DataTypes) => {
  const AiConversation = sequelize.define(
    "AiConversation",
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
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      conversationType: {
        type: DataTypes.ENUM("CUSTOMER_SUPPORT", "PRODUCT_ADVISOR", "PRODUCT_COMPARISON"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "CLOSED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "ai_conversations",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["user_id"] }, { fields: ["session_id"] }, { fields: ["conversation_type"] }],
    },
  );

  AiConversation.associate = (models) => {
    AiConversation.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    AiConversation.hasMany(models.AiMessage, { foreignKey: "conversationId", as: "messages" });
  };

  return AiConversation;
};
