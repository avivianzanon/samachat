import { Request, Response } from "express";

import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import {
  buildAuthUrl,
  disconnect,
  handleCallback,
  status
} from "../services/AgendaServices/google/GoogleOAuthService";

export const showStatus = async (_req: Request, res: Response) =>
  res.json(await status());

// O admin escolhe o closer; devolvemos a URL de consentimento do Google.
export const authUrl = async (req: Request, res: Response) => {
  const closerId = Number(req.query.closerId);
  if (!Number.isInteger(closerId)) {
    throw new AppError("ERR_AGENDA_CLOSER_NOT_FOUND", 404);
  }
  return res.json({ url: await buildAuthUrl(closerId) });
};

// Retorno do Google (sem login de usuario: a seguranca esta no "state"
// assinado). Redireciona SEMPRE para o FRONTEND_URL configurado, nunca para um
// endereco vindo da requisicao.
export const callback = async (req: Request, res: Response) => {
  const front = process.env.FRONTEND_URL || "/";
  const { code, state } = req.query as Record<string, string>;

  try {
    if (!code || !state) throw new AppError("ERR_AGENDA_GOOGLE_INVALID_STATE");
    await handleCallback(code, state);
    return res.redirect(`${front}/?agendaGoogle=ok`);
  } catch (err) {
    logger.warn({ err: err?.message }, "[agenda] callback do Google falhou");
    return res.redirect(`${front}/?agendaGoogle=error`);
  }
};

export const remove = async (req: Request, res: Response) => {
  await disconnect(Number(req.params.id));
  return res.status(204).send();
};
