module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define(
    "Cart",
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
      tableName: "carts",
      timestamps: true,
      paranoid: false,
      underscored: true,
    },
  );

  Cart.associate = (models) => {
    Cart.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Cart.hasMany(models.CartItem, { foreignKey: "cartId", as: "items" });
  };

  return Cart;
};
