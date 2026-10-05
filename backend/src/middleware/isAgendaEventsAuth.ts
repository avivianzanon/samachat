import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";

// Autentica o endpoint de eventos externos da agenda com um segredo proprio
// (AGENDA_EVENTS_TOKEN). Nao usa o token da API publica, que compara qualquer
// valor da tabela Settings. Sem a variavel definida, o endpoint fica desligado.
const isAgendaEventsAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const expected = process.env.AGENDA_EVENTS_TOKEN;
  if (!expected) {
    throw new AppError("ERR_AGENDA_EVENTS_DISABLED", 503);
  }

  const [scheme, token] = (req.headers.authorization || "").split(" ");
  const given = Buffer.from(token || "");
  const wanted = Buffer.from(expected);

  const valid =
    scheme === "Bearer" &&
    given.length === wanted.length &&
    timingSafeEqual(given, wanted);

  if (!valid) {
    throw new AppError("ERR_AGENDA_EVENTS_UNAUTHORIZED", 401);
  }

  next();
};

export default isAgendaEventsAuth;
