module.exports = (sequelize, DataTypes) => {
  const OrderStatusHistory = sequelize.define(
    "OrderStatusHistory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      fromStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      toStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      changedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
    },
    {
      tableName: "order_status_histories",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["order_id"] }, { fields: ["changed_by"] }],
    },
  );

  OrderStatusHistory.associate = (models) => {
    OrderStatusHistory.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
    OrderStatusHistory.belongsTo(models.User, { foreignKey: "changedBy", as: "changer" });
  };

  return OrderStatusHistory;
};
