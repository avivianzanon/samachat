import { Op, Sequelize, WhereOptions } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Tag from "../../models/Tag";
import KanbanColumn from "../../models/KanbanColumn";
import KanbanCard from "../../models/KanbanCard";

interface Request {
  searchParam?: string;
  queueIds?: number[];
  userId?: number;
  tagIds?: number[];
}

const ensureDefaultColumns = async (): Promise<void> => {
  const count = await KanbanColumn.count();

  if (count > 0) {
    return;
  }

  await KanbanColumn.bulkCreate([
    {
      name: "Atendimento iniciado com IA",
      key: "ai",
      position: 0,
      isActive: true,
      autoRule: "ai"
    },
    {
      name: "Atendimento humano",
      key: "human",
      position: 1,
      isActive: true,
      autoRule: "human"
    },
    { name: "Pendentes", key: "pending", position: 2, isActive: true },
    { name: "Finalizados", key: "closed", position: 3, isActive: true }
  ]);
};

const buildTicketWhere = ({
  searchParam,
  queueIds = [],
  userId,
  tagIds = []
}: Request): WhereOptions => {
  const whereCondition: WhereOptions = {
    status: { [Op.in]: ["pending", "open", "closed"] }
  };

  if (queueIds.length > 0) {
    Object.assign(whereCondition, { queueId: { [Op.in]: queueIds } });
  }

  if (typeof userId === "number") {
    Object.assign(whereCondition, { userId });
  }

  if (searchParam) {
    const sanitized = searchParam.toLowerCase().trim();
    Object.assign(whereCondition, {
      [Op.or]: [
        {
          "$contact.name$": Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("contact.name")),
            "LIKE",
            `%${sanitized}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitized}%` } },
        {
          lastMessage: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("Ticket.lastMessage")),
            "LIKE",
            `%${sanitized}%`
          )
        }
      ]
    });
  }

  return whereCondition;
};

const ListKanbanService = async ({
  searchParam,
  queueIds,
  userId,
  tagIds
}: Request): Promise<any[]> => {
  await ensureDefaultColumns();

  const columns = await KanbanColumn.findAll({
    where: { isActive: true },
    order: [["position", "ASC"]]
  });

  const whereCondition = buildTicketWhere({
    searchParam,
    queueIds,
    userId,
    tagIds
  });

  const include = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color"],
      through: { attributes: [] },
      required: !!(tagIds && tagIds.length > 0),
      where:
        tagIds && tagIds.length > 0
          ? { id: { [Op.in]: tagIds } }
          : undefined
    }
  ];

  const tickets = await Ticket.findAll({
    where: whereCondition,
    include,
    order: [["updatedAt", "DESC"]],
    limit: 500
  });

  const ticketIds = tickets.map(ticket => ticket.id);
  const cards = ticketIds.length
    ? await KanbanCard.findAll({
        where: { ticketId: { [Op.in]: ticketIds } }
      })
    : [];

  const cardMap = new Map(cards.map(card => [card.ticketId, card]));
  type KanbanCardEntry = {
    ticket: Ticket;
    position: number;
    updatedAt: Date;
  };
  type ColumnEntry = ReturnType<typeof KanbanColumn.prototype.toJSON> & {
    cards: KanbanCardEntry[];
  };

  const columnMap = new Map<number, ColumnEntry>(
    columns.map(column => [
      column.id,
      { ...column.toJSON(), cards: [] }
    ])
  );
  const fallbackColumnByKey = new Map(columns.map(column => [column.key, column.id]));
  const aiColumnId = columns.find(column => column.autoRule === "ai")?.id;
  const humanColumnId = columns.find(column => column.autoRule === "human")?.id;

  // Onde o atendimento aparece quando ninguem o posicionou a mao nem o
  // automatico ja o moveu: IA atendendo -> coluna da IA; com atendente ->
  // coluna do humano; senao pela situacao (pendente/aberto/finalizado).
  const derivedColumnId = (ticket: Ticket): number | undefined => {
    if (ticket.status !== "closed") {
      if (aiColumnId && ticket.sdrAgentEnabled === true && !ticket.userId) {
        return aiColumnId;
      }
      if (humanColumnId && ticket.userId) {
        return humanColumnId;
      }
    }
    return fallbackColumnByKey.get(ticket.status);
  };

  tickets.forEach(ticket => {
    const card = cardMap.get(ticket.id);
    const cardColumnId =
      card && columnMap.has(card.columnId) ? card.columnId : undefined;
    const columnId = cardColumnId || derivedColumnId(ticket) || columns[0]?.id;

    if (!columnId || !columnMap.has(columnId)) {
      return;
    }

    const entry = columnMap.get(columnId);
    if (!entry) {
      return;
    }

    entry.cards.push({
      ticket,
      position: card?.position ?? 9999,
      updatedAt: ticket.updatedAt
    });
  });

  const payload = columns.map(column => {
    const entry = columnMap.get(column.id) || { ...column.toJSON(), cards: [] };
    const cardsData = entry.cards
      .sort((a, b) => {
        if (a.position !== b.position) {
          return a.position - b.position;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .map(card => ({
        ticket: card.ticket,
        position: card.position
      }));

    return {
      id: column.id,
      name: column.name,
      key: column.key,
      autoRule: column.autoRule,
      position: column.position,
      count: cardsData.length,
      cards: cardsData
    };
  });

  return payload;
};

export default ListKanbanService;
