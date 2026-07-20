module.exports = (sequelize, DataTypes) => {
  const SpecificationDefinition = sequelize.define(
    "SpecificationDefinition",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
        onDelete: "CASCADE",
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      dataType: {
        type: DataTypes.ENUM("STRING", "NUMBER", "BOOLEAN", "JSON"),
        allowNull: false,
        defaultValue: "STRING",
      },
      unit: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      isFilterable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isComparable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "specification_definitions",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [{ name: "uq_spec_def_category_key", unique: true, fields: ["category_id", "key"] }],
    },
  );

  SpecificationDefinition.associate = (models) => {
    SpecificationDefinition.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    SpecificationDefinition.hasMany(models.ProductSpecification, {
      foreignKey: "specificationDefinitionId",
      as: "productSpecifications",
    });
  };

  return SpecificationDefinition;
};
