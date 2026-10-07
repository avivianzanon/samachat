import { QueryInterface } from "sequelize";

// Um atendimento so pode estar em UMA coluna. Sem indice unico, cada arrasto
// no quadro criava uma linha nova em KanbanCards (upsert sem chave unica) e a
// tela lia uma linha enquanto o movimento gravava em outra.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Mantem so a linha mais recente de cada atendimento.
    await queryInterface.sequelize.query(`
      DELETE c1 FROM KanbanCards c1
      JOIN KanbanCards c2
        ON c1.ticketId = c2.ticketId
       AND (c1.updatedAt < c2.updatedAt
            OR (c1.updatedAt = c2.updatedAt AND c1.id < c2.id))
    `);

    await queryInterface.addIndex("KanbanCards", ["ticketId"], {
      unique: true,
      name: "kanban_cards_ticket_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("KanbanCards", "kanban_cards_ticket_unique");
  }
};
