module.exports = (sequelize, DataTypes) => {
  // Records the `Idempotency-Key` header of a place-order attempt so a refresh,
  // a double-click or a network retry re-uses the order that was already
  // created instead of charging the customer twice.
  //
  // This is a separate table rather than a column on `orders` on purpose: the
  // project boots with `sequelize.sync()` (no `alter`), which creates new
  // tables but never adds columns to existing ones.
  const OrderIdempotency = sequelize.define(
    "OrderIdempotency",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      idempotencyKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "order_idempotency_keys",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        // Scoped per user so one customer's key can never resolve to another's
        // order. This unique index is also the concurrency guard: two parallel
        // submits of the same key make the second insert fail and roll back.
        { unique: true, fields: ["user_id", "idempotency_key"] },
        { fields: ["order_id"] },
      ],
    },
  );

  OrderIdempotency.associate = (models) => {
    OrderIdempotency.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    OrderIdempotency.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
  };

  return OrderIdempotency;
};
