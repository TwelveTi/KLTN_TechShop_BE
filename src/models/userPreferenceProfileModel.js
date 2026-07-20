module.exports = (sequelize, DataTypes) => {
  const UserPreferenceProfile = sequelize.define(
    "UserPreferenceProfile",
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
      preferredCategories: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      preferredBrands: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      preferredTags: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      preferredSpecs: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      minPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      maxPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      averagePrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      lastCalculatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "user_preference_profiles",
      timestamps: true,
      paranoid: false,
      underscored: true,
    },
  );

  UserPreferenceProfile.associate = (models) => {
    UserPreferenceProfile.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return UserPreferenceProfile;
};
