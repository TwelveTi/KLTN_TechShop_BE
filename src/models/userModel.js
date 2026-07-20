module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { isEmail: true },
      },
      fullName: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      avatarUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      avatarPublicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM("CUSTOMER", "ADMIN"),
        allowNull: false,
        defaultValue: "CUSTOMER",
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCKED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      emailVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: "uq_users_email", unique: true, fields: ["email"] },
        { name: "uq_users_phone", unique: true, fields: ["phone"] },
      ],
    },
  );

  User.associate = (models) => {
    User.hasMany(models.AuthProvider, { foreignKey: "userId", as: "authProviders" });
    User.hasMany(models.RefreshToken, { foreignKey: "userId", as: "refreshTokens" });
    User.hasMany(models.UserAddress, { foreignKey: "userId", as: "addresses" });
    User.hasOne(models.Cart, { foreignKey: "userId", as: "cart" });
    User.hasOne(models.Wishlist, { foreignKey: "userId", as: "wishlist" });
    User.hasMany(models.Order, { foreignKey: "userId", as: "orders" });
    User.hasMany(models.Review, { foreignKey: "userId", as: "reviews" });
    User.hasMany(models.SearchHistory, { foreignKey: "userId", as: "searchHistories" });
    User.hasMany(models.UserBehavior, { foreignKey: "userId", as: "behaviors" });
    User.hasOne(models.UserPreferenceProfile, { foreignKey: "userId", as: "preferenceProfile" });
    User.hasMany(models.RecommendationResult, { foreignKey: "userId", as: "recommendations" });
    User.hasMany(models.AiConversation, { foreignKey: "userId", as: "aiConversations" });
  };

  return User;
};
