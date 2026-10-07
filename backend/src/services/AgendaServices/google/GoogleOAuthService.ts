import axios from "axios";
import { sign, verify } from "jsonwebtoken";
import AppError from "../../../errors/AppError";
import authConfig from "../../../config/auth";
import AgendaCloser from "../../../models/AgendaCloser";
import AgendaGoogleToken from "../../../models/AgendaGoogleToken";
import { forgetAccessToken } from "./GoogleCalendarClient";
import { getGoogleConfig, isGoogleConfigured, SCOPES } from "./googleConfig";
import { encryptToken } from "./tokenCrypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PURPOSE = "agenda-google-oauth";

// "state" assinado e com validade curta: amarra o retorno do Google ao closer
// que o admin escolheu e impede forjar o callback.
export const createState = (closerId: number): string =>
  sign({ purpose: PURPOSE, closerId }, authConfig.secret, { expiresIn: "10m" });

export const readState = (state: string): number => {
  try {
    const decoded = verify(state, authConfig.secret) as any;
    if (decoded.purpose !== PURPOSE || !Number.isInteger(decoded.closerId)) {
      throw new Error("bad purpose");
    }
    return decoded.closerId;
  } catch (err) {
    throw new AppError("ERR_AGENDA_GOOGLE_INVALID_STATE", 400);
  }
};

export const buildAuthUrl = async (closerId: number): Promise<string> => {
  const cfg = getGoogleConfig();
  const closer = await AgendaCloser.findByPk(closerId);
  if (!closer) throw new AppError("ERR_AGENDA_CLOSER_NOT_FOUND", 404);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // garante o refresh_token mesmo em reconexao
    state: createState(closerId)
  });
  return `${AUTH_URL}?${params.toString()}`;
};

export const handleCallback = async (
  code: string,
  state: string
): Promise<number> => {
  const closerId = readState(state);
  const cfg = getGoogleConfig();

  const { data } = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code"
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000
    }
  );

  if (!data.refresh_token) {
    throw new AppError("ERR_AGENDA_GOOGLE_NO_REFRESH_TOKEN", 502);
  }

  const refreshTokenEnc = encryptToken(data.refresh_token);
  const existing = await AgendaGoogleToken.findOne({ where: { closerId } });
  if (existing) {
    await existing.update({ refreshTokenEnc, scope: data.scope });
  } else {
    await AgendaGoogleToken.create({
      closerId,
      refreshTokenEnc,
      scope: data.scope
    } as any);
  }
  forgetAccessToken(closerId);
  return closerId;
};

export const disconnect = async (closerId: number): Promise<void> => {
  await AgendaGoogleToken.destroy({ where: { closerId } });
  forgetAccessToken(closerId);
};

export const status = async () => ({
  configured: isGoogleConfigured(),
  connectedCloserIds: (
    await AgendaGoogleToken.findAll({ attributes: ["closerId"] })
  ).map(t => t.closerId)
});
