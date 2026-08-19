module.exports = (sequelize, DataTypes) => {
  // One row per redemption. A separate table rather than a column on `orders`
  // for three reasons, only the first of which is a workaround:
  //
  //   1. `orders` has no column for the voucher used, and the project boots with
  //      plain `sequelize.sync()` (no `alter`), which creates new tables but
  //      never adds columns to existing ones. Same constraint that made
  //      OrderIdempotency its own table.
  //   2. `usageLimitPerUser` needs a per-(discount, user) count, which a column
  //      on the order cannot answer without scanning orders.
  //   3. The amount actually granted must be frozen here, so editing or
  //      deleting the discount later cannot rewrite history.
  const DiscountUsage = sequelize.define(
    "DiscountUsage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      discountId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "discounts", key: "id" },
        onDelete: "CASCADE",
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      // What was actually taken off this order, in VND — not the discount's
      // configured value, which may be a percentage or may change later.
      discountAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      // Set when the order is cancelled, which gives the use back to the
      // shopper. Hooks into the same place that restores stock — without it a
      // cancelled order silently burns the customer's voucher.
      releasedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "discount_usages",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        // Last line of defence against double-counting one order.
        { unique: true, fields: ["discount_id", "order_id"] },
        { fields: ["discount_id", "user_id"] },
        { fields: ["order_id"] },
      ],
    },
  );

  DiscountUsage.associate = (models) => {
    DiscountUsage.belongsTo(models.Discount, { foreignKey: "discountId", as: "discount" });
    DiscountUsage.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    DiscountUsage.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
  };

  return DiscountUsage;
};
