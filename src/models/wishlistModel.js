module.exports = (sequelize, DataTypes) => {
  const Wishlist = sequelize.define(
    "Wishlist",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "wishlists",
      timestamps: true,
      paranoid: false,
      underscored: true,
    },
  );

  Wishlist.associate = (models) => {
    Wishlist.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Wishlist.hasMany(models.WishlistItem, { foreignKey: "wishlistId", as: "items" });
  };

  return Wishlist;
};
