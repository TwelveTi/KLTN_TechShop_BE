module.exports = (sequelize, DataTypes) => {
  const AuthProvider = sequelize.define(
    "AuthProvider",
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
      provider: {
        type: DataTypes.ENUM("LOCAL", "GOOGLE", "FACEBOOK"),
        allowNull: false,
      },
      providerUserId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      providerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      linkedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "auth_providers",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: "uq_auth_provider_user", unique: true, fields: ["provider", "provider_user_id"] },
        { name: "uq_auth_user_provider", unique: true, fields: ["user_id", "provider"] },
      ],
      validate: {
        validateProviderCredentials() {
          if (this.provider === "LOCAL" && !this.passwordHash) {
            throw new Error("LOCAL provider requires passwordHash");
          }
          if (["GOOGLE", "FACEBOOK"].includes(this.provider) && !this.providerUserId) {
            throw new Error("OAuth provider requires providerUserId");
          }
        },
      },
    },
  );

  AuthProvider.associate = (models) => {
    AuthProvider.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return AuthProvider;
};
