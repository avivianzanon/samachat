import { QueryInterface, DataTypes } from "sequelize";

// Eventos externos recebidos pela agenda (no-show, concluida, cancelada...).
// eventId e unico: o mesmo evento reenviado nao e processado duas vezes.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AgendaEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      eventId: { type: DataTypes.STRING(191), allowNull: false, unique: true },
      type: { type: DataTypes.STRING, allowNull: false },
      appointmentId: {
        type: DataTypes.INTEGER,
        references: { model: "AgendaAppointments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      status: { type: DataTypes.STRING, allowNull: false }, // processed | ignored
      note: { type: DataTypes.TEXT },
      payload: { type: DataTypes.TEXT },
      occurredAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  },

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("AgendaEvents")
};
