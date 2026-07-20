module.exports = (sequelize, DataTypes) => {
  const WishlistItem = sequelize.define(
    "WishlistItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      wishlistId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "wishlists", key: "id" },
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
    },
    {
      tableName: "wishlist_items",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [{ fields: ["wishlist_id"] }, { fields: ["product_id"] }, { fields: ["variant_id"] }],
    },
  );

  WishlistItem.associate = (models) => {
    WishlistItem.belongsTo(models.Wishlist, { foreignKey: "wishlistId", as: "wishlist" });
    WishlistItem.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    WishlistItem.belongsTo(models.ProductVariant, { foreignKey: "variantId", as: "variant" });
  };

  return WishlistItem;
};
