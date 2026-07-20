module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define(
    "Brand",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
      slug: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
      },
      logoUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      logoPublicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "brands",
      timestamps: true,
      paranoid: true,
      underscored: true,
    },
  );

  Brand.associate = (models) => {
    Brand.hasMany(models.Product, { foreignKey: "brandId", as: "products" });
  };

  return Brand;
};
