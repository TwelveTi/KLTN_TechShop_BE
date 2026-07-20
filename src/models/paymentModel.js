module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    "Payment",
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
      paymentMethod: {
        type: DataTypes.ENUM("COD", "VNPAY", "MOMO", "STRIPE"),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      status: {
        type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      transactionCode: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      providerPayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["order_id"] }, { fields: ["payment_method"] }, { fields: ["status"] }],
    },
  );

  Payment.associate = (models) => {
    Payment.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
  };

  return Payment;
};
