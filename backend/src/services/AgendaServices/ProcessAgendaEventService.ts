import AppError from "../../errors/AppError";
import AgendaAppointment, {
  AgendaAppointmentStatus
} from "../../models/AgendaAppointment";
import AgendaCloser from "../../models/AgendaCloser";
import AgendaEvent from "../../models/AgendaEvent";
import { logger } from "../../utils/logger";
import { AGENDA_EVENT, AgendaEventType, agendaEvents } from "./agendaEvents";

export interface ProcessEventInput {
  eventId: string;
  type: AgendaEventType;
  appointmentId?: number;
  externalId?: string;
  occurredAt?: string;
  reason?: string;
  newStartsAt?: string;
  payload?: Record<string, unknown>;
}

export interface ProcessEventResult {
  eventId: string;
  status: "processed" | "ignored";
  duplicate: boolean;
  appointmentId: number | null;
  note?: string;
}

const TARGET_STATUS: Partial<Record<AgendaEventType, AgendaAppointmentStatus>> = {
  no_show: "no_show",
  completed: "completed",
  cancelled: "cancelled"
};

const toResult = (event: AgendaEvent, duplicate: boolean): ProcessEventResult => ({
  eventId: event.eventId,
  status: event.status as "processed" | "ignored",
  duplicate,
  appointmentId: event.appointmentId || null,
  note: event.note || undefined
});

const findAppointment = async (
  input: ProcessEventInput
): Promise<AgendaAppointment | null> => {
  if (input.appointmentId) {
    return AgendaAppointment.findByPk(input.appointmentId, {
      include: [AgendaCloser]
    });
  }
  if (input.externalId) {
    return AgendaAppointment.findOne({
      where: { externalId: input.externalId },
      include: [AgendaCloser]
    });
  }
  return null;
};

// Aplica um evento vindo de fora (qualquer sistema, via POST /agenda/events).
// Idempotente por eventId. Evento sem agendamento correspondente, ou que nao
// faz sentido no estado atual, e registrado como "ignored" (nao e erro: o
// emissor nao precisa reenviar).
const processEvent = async (
  input: ProcessEventInput
): Promise<ProcessEventResult> => {
  const existing = await AgendaEvent.findOne({
    where: { eventId: input.eventId }
  });
  if (existing) return toResult(existing, true);

  const appointment = await findAppointment(input);
  const record = (status: string, note?: string) =>
    AgendaEvent.create({
      eventId: input.eventId,
      type: input.type,
      appointmentId: appointment ? appointment.id : null,
      status,
      note,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null
    } as any);

  if (!appointment) {
    return toResult(await record("ignored", "agendamento_nao_encontrado"), false);
  }

  const metadata = (() => {
    try {
      return appointment.metadata ? JSON.parse(appointment.metadata) : {};
    } catch (err) {
      return {};
    }
  })();

  if (input.type === "rescheduled") {
    const startsAt = input.newStartsAt ? new Date(input.newStartsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      throw new AppError("ERR_AGENDA_EVENT_INVALID_START", 400);
    }
    if (appointment.status !== "scheduled") {
      return toResult(
        await record("ignored", `status_atual_${appointment.status}`),
        false
      );
    }
    await appointment.update({
      startsAt,
      endsAt: new Date(startsAt.getTime() + appointment.durationMinutes * 60000),
      metadata: JSON.stringify({
        ...metadata,
        rescheduledAt: new Date().toISOString(),
        rescheduledBy: "external_event",
        previousStartsAt: appointment.startsAt
      })
    });
  } else {
    const target = TARGET_STATUS[input.type] as AgendaAppointmentStatus;
    if (appointment.status !== "scheduled") {
      return toResult(
        await record("ignored", `status_atual_${appointment.status}`),
        false
      );
    }
    await appointment.update({
      status: target,
      cancelReason: input.type === "cancelled" ? input.reason || null : appointment.cancelReason,
      metadata: JSON.stringify({
        ...metadata,
        [`${input.type}At`]: input.occurredAt || new Date().toISOString(),
        ...(input.reason ? { [`${input.type}Reason`]: input.reason } : {})
      })
    });
  }

  const event = await record("processed");

  try {
    agendaEvents.emit(AGENDA_EVENT, {
      type: input.type,
      appointment,
      reason: input.reason
    });
  } catch (err) {
    // Um assinante com defeito nao pode reverter um evento ja gravado.
    logger.warn({ err, eventId: input.eventId }, "[agenda] assinante de evento falhou");
  }

  return toResult(event, false);
};

// Dois envios simultaneos do mesmo eventId: o segundo bate na chave unica e
// recebe o resultado do primeiro, como duplicado.
const ProcessAgendaEventService = async (
  input: ProcessEventInput
): Promise<ProcessEventResult> => {
  try {
    return await processEvent(input);
  } catch (err) {
    if (err && err.name === "SequelizeUniqueConstraintError") {
      const existing = await AgendaEvent.findOne({
        where: { eventId: input.eventId }
      });
      if (existing) return toResult(existing, true);
    }
    throw err;
  }
};

export default ProcessAgendaEventService;
