module.exports = (sequelize, DataTypes) => {
  const ProductTag = sequelize.define(
    "ProductTag",
    {
      productId: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      tagId: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: "tags", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "product_tags",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
    },
  );

  return ProductTag;
};
