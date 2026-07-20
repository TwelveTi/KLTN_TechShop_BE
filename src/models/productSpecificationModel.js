module.exports = (sequelize, DataTypes) => {
  const ProductSpecification = sequelize.define(
    "ProductSpecification",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      specificationDefinitionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "specification_definitions", key: "id" },
        onDelete: "CASCADE",
      },
      valueText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      valueNumber: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
      },
      valueBoolean: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      valueJson: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "product_specifications",
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        {
          name: "uq_product_spec",
          unique: true,
          fields: ["product_id", "specification_definition_id"],
        },
      ],
    },
  );

  ProductSpecification.associate = (models) => {
    ProductSpecification.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    ProductSpecification.belongsTo(models.SpecificationDefinition, {
      foreignKey: "specificationDefinitionId",
      as: "definition",
    });
  };

  return ProductSpecification;
};
