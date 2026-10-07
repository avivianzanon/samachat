import { Request, Response } from "express";

import {
  createInstance,
  deleteInstance,
  getInstanceQr,
  getInstanceState,
  listInstances,
  logoutInstance,
  setDefaultInstance
} from "../services/EvolutionServices/EvolutionInstanceService";

export const index = async (_req: Request, res: Response): Promise<Response> =>
  res.json(await listInstances());

export const store = async (req: Request, res: Response): Promise<Response> =>
  res.status(201).json(
    await createInstance(String(req.body?.name || "").trim(), {
      label: req.body?.label,
      isDefault: Boolean(req.body?.isDefault)
    })
  );

export const makeDefault = async (req: Request, res: Response): Promise<Response> => {
  await setDefaultInstance(req.params.name);
  return res.json({ success: true });
};

export const qrcode = async (req: Request, res: Response): Promise<Response> =>
  res.json(await getInstanceQr(req.params.name));

export const state = async (req: Request, res: Response): Promise<Response> =>
  res.json({ state: await getInstanceState(req.params.name) });

export const logout = async (req: Request, res: Response): Promise<Response> => {
  await logoutInstance(req.params.name);
  return res.json({ success: true });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  await deleteInstance(req.params.name);
  return res.json({ success: true });
};
