import { QueryInterface, DataTypes } from "sequelize";

// Pipeline: cada coluna pode ter uma regra para receber clientes sozinha.
//  - autoRule = "ai":    o cliente entra quando a IA atende (ou a conversa volta para a IA)
//  - autoRule = "human": o cliente entra quando um humano assume (ou a IA passa para humano)
//  - autoRule = NULL:    so move manualmente
// Em quadros que ja existem, cria as duas colunas de controle da IA no comeco.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("KanbanColumns", "autoRule", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });

    const [rows]: any = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS total FROM KanbanColumns"
    );
    const total = Number(rows && rows[0] && rows[0].total);
    if (!total) return; // quadro novo: as colunas padrao nascem no primeiro acesso

    await queryInterface.sequelize.query(
      "UPDATE KanbanColumns SET position = position + 2"
    );
    const now = new Date();
    await queryInterface.bulkInsert("KanbanColumns", [
      {
        name: "Atendimento iniciado com IA",
        key: "ai",
        position: 0,
        isActive: true,
        autoRule: "ai",
        createdAt: now,
        updatedAt: now
      },
      {
        name: "Atendimento humano",
        key: "human",
        position: 1,
        isActive: true,
        autoRule: "human",
        createdAt: now,
        updatedAt: now
      }
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "DELETE FROM KanbanColumns WHERE `key` IN ('ai', 'human') AND autoRule IS NOT NULL"
    );
    await queryInterface.removeColumn("KanbanColumns", "autoRule");
  }
};
