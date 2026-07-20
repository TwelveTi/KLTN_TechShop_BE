module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define(
    "OrderItem",
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
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "products", key: "id" },
        onDelete: "SET NULL",
      },
      variantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "product_variants", key: "id" },
        onDelete: "SET NULL",
      },
      productName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      productSku: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      productImageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      variantName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      variantAttributes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      totalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: { min: 0 },
      },
    },
    {
      tableName: "order_items",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["order_id"] }, { fields: ["product_id"] }, { fields: ["variant_id"] }],
    },
  );

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
    OrderItem.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    OrderItem.belongsTo(models.ProductVariant, { foreignKey: "variantId", as: "variant" });
  };

  return OrderItem;
};
