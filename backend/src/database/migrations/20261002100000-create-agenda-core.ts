import { QueryInterface, DataTypes } from "sequelize";

// Agenda de reunioes do agente SDR: configuracao, closers, expediente e
// agendamentos. Config em tabela propria (e NAO em Settings) porque o token da
// API publica compara qualquer valor de Settings.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AgendaSettings", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "internal"
      },
      timezone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "America/Sao_Paulo"
      },
      slotMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      minLeadMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      defaultDurationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.createTable("AgendaClosers", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING },
      phone: { type: DataTypes.STRING },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      receivesMeetings: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      googleCalendarId: { type: DataTypes.STRING },
      lastAssignedAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.createTable("AgendaAvailabilities", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      closerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AgendaClosers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      weekday: { type: DataTypes.INTEGER, allowNull: false }, // 0=domingo
      startTime: { type: DataTypes.STRING(5), allowNull: false }, // HH:mm
      endTime: { type: DataTypes.STRING(5), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.createTable("AgendaAppointments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      closerId: {
        type: DataTypes.INTEGER,
        references: { model: "AgendaClosers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "meeting"
      },
      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: false },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "scheduled"
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "internal"
      },
      externalId: { type: DataTypes.STRING },
      meetingUrl: { type: DataTypes.STRING(1024) },
      attendeeEmail: { type: DataTypes.STRING },
      cancelReason: { type: DataTypes.TEXT },
      metadata: { type: DataTypes.TEXT },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("AgendaAppointments", ["closerId", "startsAt"]);
    await queryInterface.addIndex("AgendaAppointments", ["status", "startsAt"]);
    await queryInterface.addIndex("AgendaAppointments", ["contactId", "status"]);
    await queryInterface.addIndex("AgendaAppointments", ["externalId"]);
    await queryInterface.addIndex("AgendaAvailabilities", ["closerId", "weekday"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AgendaAppointments");
    await queryInterface.dropTable("AgendaAvailabilities");
    await queryInterface.dropTable("AgendaClosers");
    await queryInterface.dropTable("AgendaSettings");
  }
};
