import * as Yup from "yup";
import { Request, Response } from "express";

import AppError from "../errors/AppError";
import {
  getAgendaConfig,
  updateAgendaConfig
} from "../services/AgendaServices/AgendaConfigService";
import {
  cancelAppointment,
  createAppointment,
  listFreeSlots,
  rescheduleAppointment
} from "../services/AgendaServices/AgendaService";
import {
  createCloser,
  listAppointments,
  listClosers,
  removeCloser,
  setAvailability,
  showCloser,
  updateCloser
} from "../services/AgendaServices/AgendaAdminService";

const validate = async (schema: Yup.ObjectSchema<any>, data: unknown) => {
  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }
};

const id = (req: Request, name = "id"): number => Number(req.params[name]);

// ----------------------------------------------------------------- config
export const showConfig = async (_req: Request, res: Response) =>
  res.json(await getAgendaConfig());

export const updateConfig = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      provider: Yup.string().oneOf(["internal", "google"]),
      timezone: Yup.string(),
      slotMinutes: Yup.number().integer(),
      minLeadMinutes: Yup.number().integer(),
      defaultDurationMinutes: Yup.number().integer()
    }),
    req.body
  );
  return res.json(await updateAgendaConfig(req.body));
};

// ----------------------------------------------------------------- closers
export const indexClosers = async (_req: Request, res: Response) =>
  res.json(await listClosers());

export const showOneCloser = async (req: Request, res: Response) =>
  res.json(await showCloser(id(req)));

const closerSchema = {
  email: Yup.string().email().nullable(),
  phone: Yup.string().nullable(),
  userId: Yup.number().integer().nullable(),
  isActive: Yup.boolean(),
  receivesMeetings: Yup.boolean(),
  googleCalendarId: Yup.string().nullable()
};

export const storeCloser = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({ name: Yup.string().required(), ...closerSchema }),
    req.body
  );
  return res.status(201).json(await createCloser(req.body));
};

export const updateOneCloser = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({ name: Yup.string(), ...closerSchema }),
    req.body
  );
  return res.json(await updateCloser(id(req), req.body));
};

export const removeOneCloser = async (req: Request, res: Response) => {
  await removeCloser(id(req));
  return res.status(204).send();
};

export const putAvailability = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      windows: Yup.array()
        .of(
          Yup.object().shape({
            weekday: Yup.number().integer().required(),
            startTime: Yup.string().required(),
            endTime: Yup.string().required()
          })
        )
        .required()
    }),
    req.body
  );
  return res.json(await setAvailability(id(req), req.body.windows));
};

// ------------------------------------------------------------------ slots
export const slots = async (req: Request, res: Response) => {
  const { date, duration, closerId } = req.query as Record<string, string>;
  return res.json(
    await listFreeSlots({
      date,
      durationMinutes: duration ? Number(duration) : undefined,
      closerId: closerId ? Number(closerId) : undefined
    })
  );
};

// ----------------------------------------------------------- agendamentos
export const indexAppointments = async (req: Request, res: Response) => {
  const { from, to, status, closerId, contactId } = req.query as Record<
    string,
    string
  >;
  return res.json(
    await listAppointments({
      from,
      to,
      status,
      closerId: closerId ? Number(closerId) : undefined,
      contactId: contactId ? Number(contactId) : undefined
    })
  );
};

export const storeAppointment = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      title: Yup.string().required(),
      date: Yup.string().required(),
      time: Yup.string().required(),
      durationMinutes: Yup.number().integer(),
      type: Yup.string(),
      description: Yup.string(),
      contactId: Yup.number().integer(),
      ticketId: Yup.number().integer(),
      attendeeEmail: Yup.string().email(),
      closerId: Yup.number().integer()
    }),
    req.body
  );
  return res.status(201).json(
    await createAppointment({
      ...req.body,
      metadata: { source: "manual", createdByUserId: req.user.id }
    })
  );
};

export const reschedule = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      newDate: Yup.string().required(),
      newTime: Yup.string().required(),
      reason: Yup.string()
    }),
    req.body
  );
  return res.json(
    await rescheduleAppointment({ ...req.body, appointmentId: id(req) })
  );
};

export const cancel = async (req: Request, res: Response) => {
  await validate(Yup.object().shape({ reason: Yup.string() }), req.body);
  return res.json(
    await cancelAppointment({ ...req.body, appointmentId: id(req) })
  );
};
