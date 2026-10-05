import * as Yup from "yup";
import { Request, Response } from "express";

import AppError from "../errors/AppError";
import ProcessAgendaEventService from "../services/AgendaServices/ProcessAgendaEventService";

// POST /agenda/events — recebe eventos de qualquer sistema externo.
// Exemplo: { "eventId": "crm-123", "type": "no_show", "appointmentId": 42 }
export const store = async (req: Request, res: Response): Promise<Response> => {
  const schema = Yup.object().shape({
    eventId: Yup.string().required().max(191),
    type: Yup.string()
      .oneOf(["no_show", "completed", "cancelled", "rescheduled"])
      .required(),
    appointmentId: Yup.number().integer(),
    externalId: Yup.string(),
    occurredAt: Yup.string(),
    reason: Yup.string(),
    newStartsAt: Yup.string(),
    payload: Yup.object()
  });

  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  if (!req.body.appointmentId && !req.body.externalId) {
    throw new AppError("ERR_AGENDA_EVENT_NEEDS_APPOINTMENT_REF");
  }

  const result = await ProcessAgendaEventService(req.body);
  return res.status(result.duplicate ? 200 : 201).json(result);
};
