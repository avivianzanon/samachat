import { QueryInterface, DataTypes } from "sequelize";

// Refresh token do Google de cada closer, SEMPRE criptografado (AES-256-GCM).
module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.createTable("AgendaGoogleTokens", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      closerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "AgendaClosers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      refreshTokenEnc: { type: DataTypes.TEXT, allowNull: false },
      scope: { type: DataTypes.TEXT },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("AgendaGoogleTokens")
};
