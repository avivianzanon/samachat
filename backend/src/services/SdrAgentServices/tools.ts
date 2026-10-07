import AppError from "../../errors/AppError";
import AgendaAppointment from "../../models/AgendaAppointment";
import * as AgendaService from "../AgendaServices/AgendaService";
import { getAgendaConfig } from "../AgendaServices/AgendaConfigService";
import { toZonedParts } from "../AgendaServices/timezone";

// Ferramentas que o modelo pode chamar. Descricoes portadas da BIA SDR; o
// agente so conhece a abstracao de agenda (AgendaService), nunca o provedor.
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Consultar os horários REALMENTE livres na agenda para uma data. Use SEMPRE antes de sugerir ou confirmar qualquer horário ao cliente. Nunca afirme que um horário está disponível sem ter chamado esta função.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data a consultar, no formato YYYY-MM-DD"
          },
          duration: {
            type: "number",
            description: "Duração desejada em minutos. Padrão: 60"
          }
        },
        required: ["date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Criar um agendamento/reunião para o cliente. Use SOMENTE após o cliente confirmar data e horário que apareceram como livres em check_availability.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Título do agendamento (ex: 'Reunião estratégica ARKOM')"
          },
          date: { type: "string", description: "Data no formato YYYY-MM-DD" },
          time: {
            type: "string",
            description: "Horário no formato HH:MM (24h). Ex: '14:00', '09:30'"
          },
          duration: {
            type: "number",
            description: "Duração em minutos. Padrão: 60"
          },
          type: {
            type: "string",
            enum: ["demo", "meeting", "support", "followup"],
            description: "Tipo do agendamento"
          },
          description: {
            type: "string",
            description: "Pauta da reunião. Resuma o que será discutido."
          },
          email: {
            type: "string",
            description:
              "E-mail do cliente, SOMENTE se ele mesmo informou nesta conversa. Se não informou, OMITA. NUNCA invente ou deduza um e-mail."
          }
        },
        required: ["title", "date", "time", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description:
        "Reagendar o agendamento existente do cliente. Use quando o cliente pedir para mudar data ou horário. Confira o novo horário com check_availability antes.",
      parameters: {
        type: "object",
        properties: {
          new_date: {
            type: "string",
            description: "Nova data no formato YYYY-MM-DD"
          },
          new_time: {
            type: "string",
            description: "Novo horário no formato HH:MM (24h)"
          },
          reason: { type: "string", description: "Motivo (opcional)" }
        },
        required: ["new_date", "new_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description:
        "Cancelar o agendamento existente do cliente. Use quando o cliente pedir para cancelar ou desmarcar.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo do cancelamento" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Passar a conversa para um atendente humano. Use quando o cliente pedir para falar com uma pessoa, quando reclamar, quando o assunto sair do escopo da ARKOM ou quando você não tiver certeza da resposta. Depois de chamar esta função, avise o cliente de que a equipe vai assumir. NUNCA diga que vai encaminhar sem chamar esta função.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "pedido_do_cliente",
              "reclamacao",
              "fora_do_escopo",
              "duvida_sem_resposta",
              "pediu_para_nao_ser_contatado"
            ],
            description: "Motivo da transferência"
          },
          summary: {
            type: "string",
            description:
              "Resumo em uma ou duas frases do que o cliente precisa, para o atendente assumir sem reler a conversa."
          }
        },
        required: ["reason", "summary"]
      }
    }
  }
];

// Dependencias injetaveis (testes usam fakes; producao usa o AgendaService).
export interface AgendaApi {
  listFreeSlots: typeof AgendaService.listFreeSlots;
  createAppointment: typeof AgendaService.createAppointment;
  rescheduleAppointment: typeof AgendaService.rescheduleAppointment;
  cancelAppointment: typeof AgendaService.cancelAppointment;
}

export interface ToolContext {
  contactId?: number | null;
  ticketId?: number | null;
  agenda?: AgendaApi;
  onTransfer: (args: { reason: string; summary: string }) => Promise<void>;
}

// Mensagens em portugues para o modelo saber o que fazer com cada erro.
const ERROR_HINTS: Record<string, string> = {
  ERR_AGENDA_TIME_CONFLICT:
    "Horário indisponível. Chame check_availability e ofereça outro horário.",
  ERR_AGENDA_DATE_IN_PAST: "Essa data/horário já passou. Peça outra data.",
  ERR_AGENDA_INVALID_DATETIME:
    "Data ou hora em formato inválido. Use YYYY-MM-DD e HH:MM.",
  ERR_AGENDA_NO_CLOSERS:
    "Não há closers cadastrados na agenda. Use transfer_to_human.",
  ERR_AGENDA_NOT_FOUND: "Este cliente não tem agendamento ativo.",
  ERR_AGENDA_NOT_SCHEDULED: "O agendamento não está mais ativo.",
  ERR_AGENDA_NO_CLOSER_AVAILABLE:
    "Nenhum closer disponível para esse agendamento. Use transfer_to_human.",
  ERR_AGENDA_GOOGLE_NOT_CONFIGURED:
    "A agenda está indisponível no momento. Use transfer_to_human."
};

const describe = async (appointment: AgendaAppointment) => {
  const { timezone } = await getAgendaConfig();
  const local = toZonedParts(new Date(appointment.startsAt), timezone);
  return {
    id: appointment.id,
    title: appointment.title,
    date: local.date,
    time: local.time,
    duration_minutes: appointment.durationMinutes,
    status: appointment.status,
    closer: appointment.closer ? appointment.closer.name : null,
    meeting_url: appointment.meetingUrl || null
  };
};

const parseArgs = (raw: unknown): Record<string, any> | null => {
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    return null;
  }
};

export const executeTool = async (
  name: string,
  rawArgs: unknown,
  ctx: ToolContext
): Promise<Record<string, unknown>> => {
  const agenda: AgendaApi = ctx.agenda || AgendaService;
  const args = parseArgs(rawArgs);
  if (!args) {
    return { error: "invalid_arguments", message: "Argumentos inválidos." };
  }

  try {
    switch (name) {
      case "check_availability": {
        const r = await agenda.listFreeSlots({
          date: args.date,
          durationMinutes: args.duration ? Number(args.duration) : undefined
        });
        return {
          date: r.date,
          is_open: r.isOpen,
          reason: r.reason,
          timezone: r.timezone,
          duration_minutes: r.durationMinutes,
          available_slots: r.slots,
          note: r.slots.length
            ? "Ofereça ao cliente APENAS horários desta lista."
            : "Nenhum horário livre nesta data. Ofereça outra data ao cliente."
        };
      }

      case "create_appointment": {
        const appointment = await agenda.createAppointment({
          title: args.title,
          date: args.date,
          time: args.time,
          durationMinutes: args.duration ? Number(args.duration) : undefined,
          type: args.type,
          description: args.description,
          attendeeEmail: args.email,
          contactId: ctx.contactId || undefined,
          ticketId: ctx.ticketId || undefined,
          metadata: { source: "sdr_agent" }
        });
        return { ok: true, appointment: await describe(appointment) };
      }

      case "reschedule_appointment": {
        if (!ctx.contactId) return { error: "missing_contact" };
        const appointment = await agenda.rescheduleAppointment({
          contactId: ctx.contactId,
          newDate: args.new_date,
          newTime: args.new_time,
          reason: args.reason
        });
        return { ok: true, appointment: await describe(appointment) };
      }

      case "cancel_appointment": {
        if (!ctx.contactId) return { error: "missing_contact" };
        const appointment = await agenda.cancelAppointment({
          contactId: ctx.contactId,
          reason: args.reason
        });
        return { ok: true, appointment: await describe(appointment) };
      }

      case "transfer_to_human": {
        await ctx.onTransfer({
          reason: String(args.reason || "pedido_do_cliente"),
          summary: String(args.summary || "")
        });
        return {
          ok: true,
          note: "Conversa transferida. Avise o cliente de que a equipe vai assumir."
        };
      }

      default:
        return { error: "unknown_tool", message: `Ferramenta desconhecida: ${name}` };
    }
  } catch (err) {
    if (err instanceof AppError) {
      return {
        error: err.message,
        message: ERROR_HINTS[err.message] || "Não foi possível concluir essa ação."
      };
    }
    throw err; // erro inesperado: quem chamou decide (nao vira texto para o lead)
  }
};
