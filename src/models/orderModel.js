module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "RESTRICT",
      },
      addressId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "user_addresses", key: "id" },
        onDelete: "SET NULL",
      },
      receiverName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      receiverPhone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      subtotalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      shippingFee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      discountAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      totalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      status: {
        type: DataTypes.ENUM("PENDING", "PAID", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      paymentStatus: {
        type: DataTypes.ENUM("UNPAID", "PAID", "FAILED", "REFUNDED"),
        allowNull: false,
        defaultValue: "UNPAID",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "orders",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [{ fields: ["user_id"] }, { fields: ["status"] }, { fields: ["payment_status"] }],
    },
  );

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Order.belongsTo(models.UserAddress, { foreignKey: "addressId", as: "address" });
    Order.hasMany(models.OrderItem, { foreignKey: "orderId", as: "items" });
    Order.hasMany(models.OrderStatusHistory, { foreignKey: "orderId", as: "statusHistories" });
    Order.hasMany(models.Payment, { foreignKey: "orderId", as: "payments" });
    Order.hasMany(models.DiscountUsage, { foreignKey: "orderId", as: "discountUsages" });
  };

  return Order;
};
