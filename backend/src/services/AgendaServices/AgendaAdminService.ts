import { Op } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AgendaAppointment from "../../models/AgendaAppointment";
import AgendaAvailability from "../../models/AgendaAvailability";
import AgendaCloser from "../../models/AgendaCloser";
import { isValidTime, parseTimeToMinutes } from "./timezone";

export interface CloserData {
  name?: string;
  email?: string | null;
  phone?: string | null;
  userId?: number | null;
  isActive?: boolean;
  receivesMeetings?: boolean;
  googleCalendarId?: string | null;
}

export interface AvailabilityWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

export const listClosers = (): Promise<AgendaCloser[]> =>
  AgendaCloser.findAll({
    include: [AgendaAvailability],
    order: [["name", "ASC"]]
  }) as unknown as Promise<AgendaCloser[]>;

export const showCloser = async (id: number): Promise<AgendaCloser> => {
  const closer = await AgendaCloser.findByPk(id, {
    include: [AgendaAvailability]
  });
  if (!closer) throw new AppError("ERR_AGENDA_CLOSER_NOT_FOUND", 404);
  return closer;
};

export const createCloser = async (
  data: CloserData & { name: string }
): Promise<AgendaCloser> => {
  const closer = await AgendaCloser.create(data as any);
  return showCloser(closer.id);
};

export const updateCloser = async (
  id: number,
  data: CloserData
): Promise<AgendaCloser> => {
  const closer = await showCloser(id);
  await closer.update(data as any);
  return showCloser(id);
};

// Closer com historico nao e apagado: so desativado (os agendamentos antigos
// continuam apontando para ele).
export const removeCloser = async (id: number): Promise<void> => {
  const closer = await showCloser(id);
  const used = await AgendaAppointment.count({ where: { closerId: id } });
  if (used > 0) {
    await closer.update({ isActive: false });
    return;
  }
  await closer.destroy();
};

const assertWindows = (windows: AvailabilityWindow[]): void => {
  windows.forEach(w => {
    if (
      !Number.isInteger(w.weekday) ||
      w.weekday < 0 ||
      w.weekday > 6 ||
      !isValidTime(w.startTime) ||
      !isValidTime(w.endTime) ||
      parseTimeToMinutes(w.startTime) >= parseTimeToMinutes(w.endTime)
    ) {
      throw new AppError("ERR_AGENDA_INVALID_AVAILABILITY", 400);
    }
  });
};

// Substitui todo o expediente do closer de uma vez.
export const setAvailability = async (
  closerId: number,
  windows: AvailabilityWindow[]
): Promise<AgendaCloser> => {
  await showCloser(closerId);
  assertWindows(windows);

  await sequelize.transaction(async transaction => {
    await AgendaAvailability.destroy({ where: { closerId }, transaction });
    await AgendaAvailability.bulkCreate(
      windows.map(w => ({
        closerId,
        weekday: w.weekday,
        startTime: w.startTime.padStart(5, "0"),
        endTime: w.endTime.padStart(5, "0")
      })) as any,
      { transaction }
    );
  });

  return showCloser(closerId);
};

export interface ListAppointmentsFilter {
  from?: string;
  to?: string;
  status?: string;
  closerId?: number;
  contactId?: number;
}

export const listAppointments = (
  filter: ListAppointmentsFilter
): Promise<AgendaAppointment[]> => {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.closerId) where.closerId = filter.closerId;
  if (filter.contactId) where.contactId = filter.contactId;
  if (filter.from || filter.to) {
    where.startsAt = {};
    if (filter.from) where.startsAt[Op.gte] = new Date(filter.from);
    if (filter.to) where.startsAt[Op.lte] = new Date(filter.to);
  }

  return AgendaAppointment.findAll({
    where,
    include: [AgendaCloser],
    order: [["startsAt", "ASC"]],
    limit: 500
  }) as unknown as Promise<AgendaAppointment[]>;
};
