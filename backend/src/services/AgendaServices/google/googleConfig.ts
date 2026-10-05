import AppError from "../../../errors/AppError";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy"
];

// Credenciais SO de variaveis de ambiente. Nunca no codigo nem no git.
export const isGoogleConfigured = (): boolean =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.AGENDA_TOKEN_ENC_KEY
  );

export const getGoogleConfig = (): GoogleConfig => {
  if (!isGoogleConfigured()) {
    throw new AppError("ERR_AGENDA_GOOGLE_NOT_CONFIGURED", 503);
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirectUri: process.env.GOOGLE_REDIRECT_URI as string
  };
};
