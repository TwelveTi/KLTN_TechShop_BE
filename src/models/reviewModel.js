module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define(
    "Review",
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
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      orderItemId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "order_items", key: "id" },
        onDelete: "SET NULL",
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5 },
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "HIDDEN"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "reviews",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: "uq_review_order_item", unique: true, fields: ["user_id", "product_id", "order_item_id"] },
        { name: "idx_review_product_status", fields: ["product_id", "status"] },
      ],
    },
  );

  Review.associate = (models) => {
    Review.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Review.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    Review.belongsTo(models.OrderItem, { foreignKey: "orderItemId", as: "orderItem" });
  };

  return Review;
};
