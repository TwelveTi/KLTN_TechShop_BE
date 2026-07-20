module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define(
    "CartItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      cartId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "carts", key: "id" },
        onDelete: "CASCADE",
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      variantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "product_variants", key: "id" },
        onDelete: "SET NULL",
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: { min: 1 },
      },
    },
    {
      tableName: "cart_items",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["cart_id"] }, { fields: ["product_id"] }, { fields: ["variant_id"] }],
    },
  );

  CartItem.associate = (models) => {
    CartItem.belongsTo(models.Cart, { foreignKey: "cartId", as: "cart" });
    CartItem.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    CartItem.belongsTo(models.ProductVariant, { foreignKey: "variantId", as: "variant" });
  };

  return CartItem;
};
