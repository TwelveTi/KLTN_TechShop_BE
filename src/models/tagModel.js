module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define(
    "Tag",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      slug: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "tags",
      timestamps: true,
      paranoid: true,
      underscored: true,
    },
  );

  Tag.associate = (models) => {
    Tag.belongsToMany(models.Product, {
      through: models.ProductTag,
      foreignKey: "tagId",
      otherKey: "productId",
      as: "products",
    });
  };

  return Tag;
};
