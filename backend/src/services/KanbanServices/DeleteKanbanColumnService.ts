import AppError from "../../errors/AppError";
import KanbanCard from "../../models/KanbanCard";
import KanbanColumn from "../../models/KanbanColumn";

// Exclui a coluna. Os atendimentos dela nao somem: perdem o posicionamento e
// voltam para a coluna que combina com eles (regra automatica ou status).
const DeleteKanbanColumnService = async (columnId: string): Promise<void> => {
  const column = await KanbanColumn.findByPk(columnId);

  if (!column) {
    throw new AppError("ERR_NO_KANBAN_COLUMN_FOUND", 404);
  }

  // Sem nenhuma coluna o quadro recria as padrao sozinho; evita essa surpresa.
  const total = await KanbanColumn.count();
  if (total <= 1) {
    throw new AppError("ERR_KANBAN_LAST_COLUMN", 400);
  }

  await KanbanCard.destroy({ where: { columnId: column.id } });
  await column.destroy();
};

export default DeleteKanbanColumnService;
