import { Op } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AgendaAppointment from "../../models/AgendaAppointment";
import AgendaAvailability from "../../models/AgendaAvailability";
import AgendaCloser from "../../models/AgendaCloser";
import { logger } from "../../utils/logger";
import { getAgendaConfig } from "./AgendaConfigService";
import { BusyInterval, computeFreeSlots, TimeWindow, todayInZone } from "./slots";
import {
  isValidDate,
  isValidTime,
  parseTimeToMinutes,
  toZonedParts,
  weekdayOfDate,
  zonedToUtc
} from "./timezone";
import {
  AgendaConfig,
  AgendaProvider,
  AgendaProviderName,
  AppointmentRef,
  BusySource,
  CancelAppointmentInput,
  CreateAppointmentInput,
  EventSink,
  ListSlotsInput,
  ListSlotsResult,
  RescheduleAppointmentInput
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DURATION = 15;

const parseMetadata = (raw?: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
};

const nextDate = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

const byRoundRobin = (a: AgendaCloser, b: AgendaCloser): number => {
  const at = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
  const bt = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
  return at - bt || a.id - b.id;
};

interface ProviderOptions {
  name?: AgendaProviderName;
  busySource?: BusySource;
  eventSink?: EventSink;
}

// Agenda interna: closers, expediente e agendamentos vivem no banco do
// SamaChat. Tambem serve de base para provedores externos (Google), que so
// acrescentam "o que ja esta ocupado la fora" (busySource) e espelham os
// eventos (eventSink). Assim o historico fica sempre no SamaChat.
export default class InternalAgendaProvider implements AgendaProvider {
  readonly name: AgendaProviderName;

  private busySource?: BusySource;

  private eventSink?: EventSink;

  constructor(options: ProviderOptions = {}) {
    this.name = options.name || "internal";
    this.busySource = options.busySource;
    this.eventSink = options.eventSink;
  }

  // ---------------------------------------------------------------- consulta
  async listFreeSlots(input: ListSlotsInput): Promise<ListSlotsResult> {
    const cfg = await getAgendaConfig();
    const durationMinutes = Math.max(
      MIN_DURATION,
      Number(input.durationMinutes) || cfg.defaultDurationMinutes
    );
    const base = {
      date: input.date,
      timezone: cfg.timezone,
      durationMinutes,
      slots: [] as string[]
    };

    if (!isValidDate(input.date)) {
      throw new AppError("ERR_AGENDA_INVALID_DATETIME", 400);
    }

    const now = new Date();
    if (input.date < todayInZone(now, cfg.timezone)) {
      return { ...base, isOpen: false, reason: "data_no_passado" };
    }

    const closers = await this.loadClosers(input.closerId);
    if (closers.length === 0) {
      return { ...base, isOpen: false, reason: "sem_closers_cadastrados" };
    }

    const weekday = weekdayOfDate(input.date);
    const from = zonedToUtc(input.date, "00:00", cfg.timezone);
    const to = zonedToUtc(nextDate(input.date), "00:00", cfg.timezone);

    const slots = new Set<string>();
    let hasExpedient = false;

    for (const closer of closers) {
      const windows = this.windowsFor(closer, weekday);
      if (windows.length === 0) continue;
      hasExpedient = true;

      const busy = await this.busyFor(closer, from, to);
      computeFreeSlots({
        date: input.date,
        timeZone: cfg.timezone,
        windows,
        busy,
        durationMinutes,
        stepMinutes: cfg.slotMinutes,
        minLeadMinutes: cfg.minLeadMinutes,
        now
      }).forEach(slot => slots.add(slot));
    }

    if (!hasExpedient) {
      return { ...base, isOpen: false, reason: "fora_dos_dias_de_atendimento" };
    }

    return { ...base, isOpen: true, slots: Array.from(slots).sort() };
  }

  // ------------------------------------------------------------------ criar
  async createAppointment(
    input: CreateAppointmentInput
  ): Promise<AgendaAppointment> {
    const cfg = await getAgendaConfig();
    this.assertDateTime(input.date, input.time);

    const durationMinutes = Math.max(
      MIN_DURATION,
      Number(input.durationMinutes) || cfg.defaultDurationMinutes
    );
    const startsAt = zonedToUtc(input.date, input.time, cfg.timezone);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    if (startsAt.getTime() < Date.now()) {
      throw new AppError("ERR_AGENDA_DATE_IN_PAST", 400);
    }

    // Idempotencia: o mesmo contato pedindo o mesmo horario duas vezes (ex.:
    // mensagem repetida) devolve o agendamento que ja existe.
    if (input.contactId) {
      const same = await AgendaAppointment.findOne({
        where: {
          contactId: input.contactId,
          status: "scheduled",
          startsAt
        },
        include: [AgendaCloser]
      });
      if (same) return same;
    }

    const closers = await this.loadClosers(input.closerId);
    if (closers.length === 0) {
      throw new AppError(
        input.closerId ? "ERR_AGENDA_CLOSER_NOT_FOUND" : "ERR_AGENDA_NO_CLOSERS",
        404
      );
    }

    // Rodizio: quem recebeu ha mais tempo (ou nunca) tem prioridade.
    for (const closer of [...closers].sort(byRoundRobin)) {
      if (!(await this.isFree(closer, startsAt, endsAt, cfg))) continue;

      const created = await this.bookWithLock(closer, input, {
        startsAt,
        endsAt,
        durationMinutes
      });
      if (!created) continue; // alguem ocupou entre a checagem e a reserva

      await this.syncAfterCreate(created, closer);
      return created;
    }

    throw new AppError("ERR_AGENDA_TIME_CONFLICT", 409);
  }

  // --------------------------------------------------------------- remarcar
  async rescheduleAppointment(
    input: RescheduleAppointmentInput
  ): Promise<AgendaAppointment> {
    const cfg = await getAgendaConfig();
    this.assertDateTime(input.newDate, input.newTime);

    const appointment = await this.findTarget(input);
    if (appointment.status !== "scheduled") {
      throw new AppError("ERR_AGENDA_NOT_SCHEDULED", 409);
    }

    const startsAt = zonedToUtc(input.newDate, input.newTime, cfg.timezone);
    const endsAt = new Date(
      startsAt.getTime() + appointment.durationMinutes * 60000
    );
    if (startsAt.getTime() < Date.now()) {
      throw new AppError("ERR_AGENDA_DATE_IN_PAST", 400);
    }

    const closer = appointment.closer;
    if (!closer) throw new AppError("ERR_AGENDA_NO_CLOSER_AVAILABLE", 409);

    if (!(await this.isFree(closer, startsAt, endsAt, cfg, appointment.id))) {
      throw new AppError("ERR_AGENDA_TIME_CONFLICT", 409);
    }

    const previous = { startsAt: appointment.startsAt };
    await sequelize.transaction(async transaction => {
      await AgendaCloser.findByPk(closer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (await this.hasDbConflict(closer.id, startsAt, endsAt, transaction, appointment.id)) {
        throw new AppError("ERR_AGENDA_TIME_CONFLICT", 409);
      }
      await appointment.update(
        {
          startsAt,
          endsAt,
          metadata: JSON.stringify({
            ...parseMetadata(appointment.metadata),
            rescheduledAt: new Date().toISOString(),
            rescheduledReason: input.reason || null,
            previousStartsAt: previous.startsAt
          })
        },
        { transaction }
      );
    });

    await this.safeSync(appointment, "reschedule", () =>
      this.eventSink ? this.eventSink.onReschedule(appointment, closer) : undefined
    );
    return appointment;
  }

  // --------------------------------------------------------------- cancelar
  async cancelAppointment(
    input: CancelAppointmentInput
  ): Promise<AgendaAppointment> {
    const appointment = await this.findTarget(input);
    if (appointment.status === "cancelled") return appointment;
    if (appointment.status !== "scheduled") {
      throw new AppError("ERR_AGENDA_NOT_SCHEDULED", 409);
    }

    await appointment.update({
      status: "cancelled",
      cancelReason: input.reason || null,
      metadata: JSON.stringify({
        ...parseMetadata(appointment.metadata),
        cancelledAt: new Date().toISOString()
      })
    });

    await this.safeSync(appointment, "cancel", () =>
      this.eventSink
        ? this.eventSink.onCancel(appointment, appointment.closer || null)
        : undefined
    );
    return appointment;
  }

  // ---------------------------------------------------------------- helpers
  private assertDateTime(date: string, time: string): void {
    if (!isValidDate(date) || !isValidTime(time)) {
      throw new AppError("ERR_AGENDA_INVALID_DATETIME", 400);
    }
  }

  private async loadClosers(closerId?: number): Promise<AgendaCloser[]> {
    return AgendaCloser.findAll({
      where: {
        isActive: true,
        receivesMeetings: true,
        ...(closerId ? { id: closerId } : {})
      },
      include: [AgendaAvailability],
      order: [["id", "ASC"]]
    });
  }

  private windowsFor(closer: AgendaCloser, weekday: number): TimeWindow[] {
    return (closer.availabilities || [])
      .filter(a => a.weekday === weekday)
      .map(a => ({
        startMinutes: parseTimeToMinutes(a.startTime),
        endMinutes: parseTimeToMinutes(a.endTime)
      }));
  }

  private async busyFor(
    closer: AgendaCloser,
    from: Date,
    to: Date,
    excludeId?: number
  ): Promise<BusyInterval[]> {
    const rows = await AgendaAppointment.findAll({
      where: {
        closerId: closer.id,
        status: "scheduled",
        startsAt: { [Op.lt]: to },
        endsAt: { [Op.gt]: from },
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
      }
    });
    const busy: BusyInterval[] = rows.map(r => ({
      startsAt: new Date(r.startsAt),
      endsAt: new Date(r.endsAt)
    }));

    if (this.busySource) {
      busy.push(...(await this.busySource.getBusy(closer, from, to)));
    }
    return busy;
  }

  // O horario cabe no expediente do closer e nao colide com nada?
  private async isFree(
    closer: AgendaCloser,
    startsAt: Date,
    endsAt: Date,
    cfg: AgendaConfig,
    excludeId?: number
  ): Promise<boolean> {
    const local = toZonedParts(startsAt, cfg.timezone);
    const startMinutes = parseTimeToMinutes(local.time);
    const endMinutes =
      startMinutes + Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);

    const fits = this.windowsFor(closer, weekdayOfDate(local.date)).some(
      w => startMinutes >= w.startMinutes && endMinutes <= w.endMinutes
    );
    if (!fits) return false;

    const busy = await this.busyFor(closer, startsAt, endsAt, excludeId);
    return !busy.some(
      b =>
        startsAt.getTime() < b.endsAt.getTime() &&
        endsAt.getTime() > b.startsAt.getTime()
    );
  }

  private async hasDbConflict(
    closerId: number,
    startsAt: Date,
    endsAt: Date,
    transaction: any,
    excludeId?: number
  ): Promise<boolean> {
    const count = await AgendaAppointment.count({
      where: {
        closerId,
        status: "scheduled",
        startsAt: { [Op.lt]: endsAt },
        endsAt: { [Op.gt]: startsAt },
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
      },
      transaction
    });
    return count > 0;
  }

  // Reserva sob trava na linha do closer: duas reservas simultaneas para o
  // mesmo horario nao passam juntas. Devolve null se o horario foi tomado.
  private async bookWithLock(
    closer: AgendaCloser,
    input: CreateAppointmentInput,
    when: { startsAt: Date; endsAt: Date; durationMinutes: number }
  ): Promise<AgendaAppointment | null> {
    return sequelize.transaction(async transaction => {
      await AgendaCloser.findByPk(closer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (
        await this.hasDbConflict(closer.id, when.startsAt, when.endsAt, transaction)
      ) {
        return null;
      }

      const created = await AgendaAppointment.create(
        {
          closerId: closer.id,
          contactId: input.contactId,
          ticketId: input.ticketId,
          title: input.title,
          description: input.description,
          type: input.type || "meeting",
          startsAt: when.startsAt,
          endsAt: when.endsAt,
          durationMinutes: when.durationMinutes,
          status: "scheduled",
          provider: this.name,
          attendeeEmail: input.attendeeEmail,
          metadata: JSON.stringify(input.metadata || {})
        },
        { transaction }
      );

      await closer.update({ lastAssignedAt: new Date() }, { transaction });
      created.closer = closer;
      return created;
    });
  }

  private async syncAfterCreate(
    appointment: AgendaAppointment,
    closer: AgendaCloser
  ): Promise<void> {
    if (!this.eventSink) return;
    await this.safeSync(appointment, "create", async () => {
      const result = await this.eventSink!.onCreate(appointment, closer);
      if (result && (result.externalId || result.meetingUrl)) {
        await appointment.update({
          externalId: result.externalId,
          meetingUrl: result.meetingUrl
        });
      }
    });
  }

  // Falha no provedor externo nao desfaz o agendamento (ele ja esta salvo e
  // visivel no SamaChat): fica registrada no metadata para reprocessar.
  private async safeSync(
    appointment: AgendaAppointment,
    label: string,
    fn: () => Promise<unknown> | undefined
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      logger.warn(
        { err, appointmentId: appointment.id },
        `[agenda] falha ao sincronizar (${label}) com ${this.name}`
      );
      await appointment.update({
        metadata: JSON.stringify({
          ...parseMetadata(appointment.metadata),
          syncError: { at: new Date().toISOString(), step: label, message: String(err?.message || err) }
        })
      });
    }
  }

  private async findTarget(ref: AppointmentRef): Promise<AgendaAppointment> {
    let appointment: AgendaAppointment | null = null;

    // O closer vem com o expediente: remarcar precisa conferir o horario novo.
    const include = [{ model: AgendaCloser, include: [AgendaAvailability] }];

    if (ref.appointmentId) {
      appointment = await AgendaAppointment.findByPk(ref.appointmentId, {
        include
      });
    } else if (ref.contactId) {
      appointment = await AgendaAppointment.findOne({
        where: { contactId: ref.contactId, status: "scheduled" },
        include,
        order: [["startsAt", "ASC"]]
      });
    }

    if (!appointment) throw new AppError("ERR_AGENDA_NOT_FOUND", 404);
    return appointment;
  }
}
