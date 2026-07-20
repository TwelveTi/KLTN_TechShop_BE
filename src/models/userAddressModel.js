module.exports = (sequelize, DataTypes) => {
  const UserAddress = sequelize.define(
    "UserAddress",
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
      receiverName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      receiverPhone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      province: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      district: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      ward: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      addressLine: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "user_addresses",
      timestamps: true,
      paranoid: true,
      underscored: true,
    },
  );

  UserAddress.associate = (models) => {
    UserAddress.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserAddress.hasMany(models.Order, { foreignKey: "addressId", as: "orders" });
  };

  return UserAddress;
};
