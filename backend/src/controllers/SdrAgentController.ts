import * as Yup from "yup";
import { Request, Response } from "express";

import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import SimulateSdrAgentService from "../services/SdrAgentServices/SimulateSdrAgentService";
import {
  effectivePrompt,
  getSdrAgentSettings,
  updateSdrAgentSettings
} from "../services/SdrAgentServices/SdrAgentSettingsService";

const validate = async (schema: Yup.ObjectSchema<any>, data: unknown) => {
  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }
};

export const showSettings = async (_req: Request, res: Response) => {
  const settings = await getSdrAgentSettings();
  return res.json({
    ...settings.toJSON(),
    // O que de fato vai para o modelo (a configuracao pode estar vazia = padrao).
    effectivePrompt: effectivePrompt(settings)
  });
};

export const updateSettings = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      isEnabled: Yup.boolean(),
      autoEnableForNewTickets: Yup.boolean(),
      allowedNumbers: Yup.string().nullable(),
      agentName: Yup.string(),
      companyName: Yup.string(),
      systemPrompt: Yup.string().nullable(),
      model: Yup.string().nullable(),
      temperature: Yup.number().nullable(),
      maxHistoryMessages: Yup.number().integer(),
      maxToolRounds: Yup.number().integer(),
      replyDelaySeconds: Yup.number().integer()
    }),
    req.body
  );
  return res.json(await updateSdrAgentSettings(req.body));
};

// Liga (true), desliga (false) ou volta a regra automatica (null) neste ticket.
export const setTicketAgent = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({ enabled: Yup.boolean().nullable() }),
    req.body
  );
  const ticket = await Ticket.findByPk(req.params.ticketId);
  if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);

  const enabled = req.body.enabled === undefined ? null : req.body.enabled;
  await ticket.update({ sdrAgentEnabled: enabled });
  return res.json({ ticketId: ticket.id, sdrAgentEnabled: ticket.sdrAgentEnabled });
};

export const simulate = async (req: Request, res: Response) => {
  await validate(
    Yup.object().shape({
      messages: Yup.array()
        .of(
          Yup.object().shape({
            role: Yup.string().oneOf(["user", "assistant"]).required(),
            content: Yup.string().required()
          })
        )
        .min(1)
        .required(),
      contactName: Yup.string(),
      contactNumber: Yup.string()
    }),
    req.body
  );
  return res.json(await SimulateSdrAgentService(req.body));
};
