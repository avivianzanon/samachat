import AppError from "../../errors/AppError";
import KanbanColumn from "../../models/KanbanColumn";
import { AUTO_RULES } from "./KanbanAutoMoveService";

interface Request {
  name: string;
  key?: string;
  isActive?: boolean;
  autoRule?: string | null;
}

const sanitizeKey = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

const CreateKanbanColumnService = async ({
  name,
  key,
  isActive = true,
  autoRule
}: Request): Promise<KanbanColumn> => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new AppError("ERR_KANBAN_COLUMN_NAME_REQUIRED");
  }

  if (autoRule && !AUTO_RULES.includes(autoRule)) {
    throw new AppError("ERR_KANBAN_INVALID_AUTO_RULE");
  }

  // A chave e interna (o usuario nao precisa digitar): vem do nome e, se ja
  // existir, ganha um numero no final ("reuniao", "reuniao_2"...).
  const baseKey = sanitizeKey(key ? key : trimmedName) || "coluna";
  let nextKey = baseKey;
  for (let n = 2; await KanbanColumn.findOne({ where: { key: nextKey } }); n += 1) {
    if (key) throw new AppError("ERR_KANBAN_COLUMN_DUPLICATED");
    nextKey = `${baseKey}_${n}`;
  }

  const maxPosition = await KanbanColumn.max("position");
  const position = Number.isFinite(maxPosition)
    ? Number(maxPosition) + 1
    : 0;

  const column = await KanbanColumn.create({
    name: trimmedName,
    key: nextKey,
    isActive,
    autoRule: autoRule || null,
    position
  });

  return column;
};

export default CreateKanbanColumnService;
