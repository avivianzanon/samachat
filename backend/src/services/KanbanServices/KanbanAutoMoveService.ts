import KanbanCard from "../../models/KanbanCard";
import KanbanColumn from "../../models/KanbanColumn";
import { logger } from "../../utils/logger";

export type KanbanAutoEvent = "ai" | "human";

export const AUTO_RULES: string[] = ["ai", "human"];

// Move o atendimento para a coluna que tem a regra automatica daquele evento
// (a primeira ativa, na ordem do quadro). Nunca derruba quem chamou: se der
// erro, so registra no log. Sem coluna com a regra, nao faz nada.
const KanbanAutoMoveService = async (
  ticketId: number,
  event: KanbanAutoEvent
): Promise<void> => {
  try {
    const column = await KanbanColumn.findOne({
      where: { autoRule: event, isActive: true },
      order: [["position", "ASC"]]
    });
    if (!column) return;

    const [card] = await KanbanCard.findOrCreate({
      where: { ticketId },
      defaults: { ticketId, columnId: column.id, position: 0 }
    });

    if (card.columnId !== column.id) {
      await card.update({ columnId: column.id, position: 0 });
    }
  } catch (err) {
    logger.warn({ err, ticketId, event }, "[kanban] auto-move falhou");
  }
};

export default KanbanAutoMoveService;
