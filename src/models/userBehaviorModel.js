module.exports = (sequelize, DataTypes) => {
  const UserBehavior = sequelize.define(
    "UserBehavior",
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
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "products", key: "id" },
        onDelete: "SET NULL",
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "categories", key: "id" },
        onDelete: "SET NULL",
      },
      behaviorType: {
        type: DataTypes.ENUM("SEARCH", "VIEW_PRODUCT", "ADD_TO_CART", "PURCHASE", "FAVORITE", "REVIEW", "CLICK_RECOMMENDATION"),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "user_behaviors",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: "idx_behavior_user_time", fields: ["user_id", "occurred_at"] },
        { name: "idx_behavior_session_time", fields: ["session_id", "occurred_at"] },
        { name: "idx_behavior_product_type", fields: ["product_id", "behavior_type"] },
        { name: "idx_behavior_category_type", fields: ["category_id", "behavior_type"] },
        { name: "idx_behavior_type_time", fields: ["behavior_type", "occurred_at"] },
      ],
    },
  );

  UserBehavior.associate = (models) => {
    UserBehavior.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserBehavior.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    UserBehavior.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
  };

  return UserBehavior;
};
