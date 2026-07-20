module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "categories", key: "id" },
        onDelete: "SET NULL",
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imagePublicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "categories",
      timestamps: true,
      paranoid: true,
      underscored: true,
    },
  );

  Category.associate = (models) => {
    Category.belongsTo(models.Category, { foreignKey: "parentId", as: "parent" });
    Category.hasMany(models.Category, { foreignKey: "parentId", as: "children" });
    Category.hasMany(models.Product, { foreignKey: "categoryId", as: "products" });
    Category.hasMany(models.SpecificationDefinition, {
      foreignKey: "categoryId",
      as: "specificationDefinitions",
    });
    Category.hasMany(models.SearchHistory, { foreignKey: "categoryId", as: "searchHistories" });
    Category.hasMany(models.UserBehavior, { foreignKey: "categoryId", as: "behaviors" });
  };

  return Category;
};
