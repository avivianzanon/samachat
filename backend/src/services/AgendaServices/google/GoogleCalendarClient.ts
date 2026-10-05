import axios, { AxiosInstance } from "axios";
import AgendaCloser from "../../../models/AgendaCloser";
import AgendaGoogleToken from "../../../models/AgendaGoogleToken";
import AppError from "../../../errors/AppError";
import { getGoogleConfig } from "./googleConfig";
import { decryptToken } from "./tokenCrypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_URL = "https://www.googleapis.com/calendar/v3";

interface CachedAccess {
  token: string;
  expiresAt: number;
}

// Access token dura ~1h: guardado so em memoria; o que persiste e o refresh
// token (criptografado).
const accessCache = new Map<number, CachedAccess>();

export const forgetAccessToken = (closerId: number): void => {
  accessCache.delete(closerId);
};

export const calendarIdOf = (closer: AgendaCloser): string =>
  closer.googleCalendarId || "primary";

const eventsUrl = (closer: AgendaCloser, eventId?: string): string => {
  const base = `${API_URL}/calendars/${encodeURIComponent(calendarIdOf(closer))}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
};

// Cliente fino da API do Google Calendar (REST). `http` e injetavel para teste.
export default class GoogleCalendarClient {
  private http: AxiosInstance;

  constructor(http?: AxiosInstance) {
    this.http = http || axios.create({ timeout: 15000 });
  }

  async hasConnection(closerId: number): Promise<boolean> {
    return (await AgendaGoogleToken.count({ where: { closerId } })) > 0;
  }

  private async accessToken(closerId: number): Promise<string> {
    const cached = accessCache.get(closerId);
    if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

    const row = await AgendaGoogleToken.findOne({ where: { closerId } });
    if (!row) throw new AppError("ERR_AGENDA_GOOGLE_NOT_CONNECTED", 409);

    const cfg = getGoogleConfig();
    const { data } = await this.http.post(
      TOKEN_URL,
      new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: decryptToken(row.refreshTokenEnc),
        grant_type: "refresh_token"
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    accessCache.set(closerId, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000
    });
    return data.access_token;
  }

  private async auth(closerId: number) {
    return {
      headers: { Authorization: `Bearer ${await this.accessToken(closerId)}` }
    };
  }

  async freeBusy(
    closer: AgendaCloser,
    from: Date,
    to: Date
  ): Promise<{ start: string; end: string }[]> {
    const calendarId = calendarIdOf(closer);
    const { data } = await this.http.post(
      `${API_URL}/freeBusy`,
      {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: calendarId }]
      },
      await this.auth(closer.id)
    );
    return data?.calendars?.[calendarId]?.busy || [];
  }

  async insertEvent(
    closer: AgendaCloser,
    body: Record<string, unknown>,
    sendUpdates: "all" | "none"
  ): Promise<{ id: string; hangoutLink?: string }> {
    const { data } = await this.http.post(eventsUrl(closer), body, {
      ...(await this.auth(closer.id)),
      params: { conferenceDataVersion: 1, sendUpdates }
    });
    return data;
  }

  async patchEvent(
    closer: AgendaCloser,
    eventId: string,
    body: Record<string, unknown>
  ): Promise<void> {
    await this.http.patch(eventsUrl(closer, eventId), body, {
      ...(await this.auth(closer.id)),
      params: { sendUpdates: "all" }
    });
  }

  async deleteEvent(closer: AgendaCloser, eventId: string): Promise<void> {
    try {
      await this.http.delete(eventsUrl(closer, eventId), {
        ...(await this.auth(closer.id)),
        params: { sendUpdates: "all" }
      });
    } catch (err) {
      // Evento ja apagado la fora: nada a fazer.
      if ([404, 410].includes(err?.response?.status)) return;
      throw err;
    }
  }
}
