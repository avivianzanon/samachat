import * as Yup from "yup";
import { Request, Response } from "express";

import AppError from "../errors/AppError";
import {
  getPublicIntegration,
  updateIntegration
} from "../services/IntegrationSettingsServices/IntegrationSettingsService";
import {
  ENGINE_LABELS,
  EngineId,
  getActiveEngine,
  getEngineStates
} from "../services/AiEngineServices/engines";
import { getIntegrationStatus } from "../services/IntegrationSettingsServices/IntegrationStatusService";
import TestIntegrationService from "../services/IntegrationSettingsServices/TestIntegrationService";
import { isProvider } from "../services/IntegrationSettingsServices/providers";

const assertProvider = (provider: string): void => {
  if (!isProvider(provider)) throw new AppError("ERR_INTEGRATION_UNKNOWN", 404);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  assertProvider(req.params.provider);
  return res.json(await getPublicIntegration(req.params.provider));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  assertProvider(req.params.provider);

  const schema = Yup.object().shape({
    isActive: Yup.boolean(),
    values: Yup.object(),
    clearSecrets: Yup.array().of(Yup.string())
  });
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  return res.json(await updateIntegration(req.params.provider, req.body));
};

export const status = async (req: Request, res: Response): Promise<Response> => {
  assertProvider(req.params.provider);
  return res.json(await getIntegrationStatus(req.params.provider));
};

// Qual IA conversa com os leads e o estado de cada uma (sem segredos).
export const engines = async (_req: Request, res: Response): Promise<Response> => {
  const states = await getEngineStates();
  const active = await getActiveEngine();
  const list = (Object.keys(states) as EngineId[]).map(id => ({
    id,
    label: ENGINE_LABELS[id],
    ...states[id]
  }));
  return res.json({
    active,
    activeLabel: active ? ENGINE_LABELS[active] : null,
    engines: list
  });
};

export const test = async (req: Request, res: Response): Promise<Response> => {
  assertProvider(req.params.provider);
  return res.json(await TestIntegrationService(req.params.provider));
};
