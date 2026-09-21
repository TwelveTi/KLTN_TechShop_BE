// Chunk văn bản đã embedding, phục vụ RAG retrieval.
module.exports = (sequelize, DataTypes) => {
  const DocumentChunk = sequelize.define(
    "DocumentChunk",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sourceType: {
        type: DataTypes.ENUM("POLICY", "PRODUCT", "REVIEW"),
        allowNull: false,
      },
      sourceId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      sourceName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      chunkIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      content: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      embedding: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      embeddingModel: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      tokenCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "document_chunks",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      underscored: true,
      indexes: [
        { fields: ["source_type", "source_id"] },
        { fields: ["source_type"] },
      ],
    },
  );

  return DocumentChunk;
};
