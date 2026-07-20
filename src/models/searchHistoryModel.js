module.exports = (sequelize, DataTypes) => {
  const SearchHistory = sequelize.define(
    "SearchHistory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      sessionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      keyword: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "categories", key: "id" },
        onDelete: "SET NULL",
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "products", key: "id" },
        onDelete: "SET NULL",
      },
      filters: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      resultCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 },
      },
      searchedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "search_histories",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: "idx_search_user_time", fields: ["user_id", "searched_at"] },
        { name: "idx_search_session_time", fields: ["session_id", "searched_at"] },
        { name: "idx_search_keyword", fields: ["keyword"] },
      ],
    },
  );

  SearchHistory.associate = (models) => {
    SearchHistory.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    SearchHistory.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    SearchHistory.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
  };

  return SearchHistory;
};
