process.env.JWT_SECRET = "segredo-de-teste";
process.env.AGENDA_TOKEN_ENC_KEY = "a".repeat(64);
process.env.GOOGLE_CLIENT_ID = "id-teste";
process.env.GOOGLE_CLIENT_SECRET = "secret-teste";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:8080/agenda/google/callback";

import { sign } from "jsonwebtoken";
import {
  decryptToken,
  encryptToken
} from "../../../../services/AgendaServices/google/tokenCrypto";
import {
  createState,
  readState
} from "../../../../services/AgendaServices/google/GoogleOAuthService";
import GoogleBusySource from "../../../../services/AgendaServices/google/GoogleBusySource";
import GoogleEventSink from "../../../../services/AgendaServices/google/GoogleEventSink";

jest.mock("../../../../services/AgendaServices/AgendaConfigService", () => ({
  getAgendaConfig: async () => ({ timezone: "America/Sao_Paulo" })
}));

const closer: any = { id: 7, email: "closer@x.com", googleCalendarId: null };
const from = new Date("2026-10-05T03:00:00Z");
const to = new Date("2026-10-06T03:00:00Z");

describe("tokenCrypto", () => {
  it("criptografa e descriptografa", () => {
    const enc = encryptToken("refresh-token-secreto");
    expect(enc).not.toContain("refresh-token-secreto");
    expect(decryptToken(enc)).toBe("refresh-token-secreto");
  });

  it("gera textos diferentes para o mesmo token (iv aleatorio)", () => {
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });

  it("detecta adulteracao", () => {
    const [iv, tag, data] = encryptToken("abc").split(".");
    const tampered = [iv, tag, Buffer.from("zzzz").toString("base64")].join(".");
    expect(() => decryptToken(tampered)).toThrow();
    expect(data).toBeTruthy();
  });

  it("recusa gravar sem chave valida", () => {
    const saved = process.env.AGENDA_TOKEN_ENC_KEY;
    process.env.AGENDA_TOKEN_ENC_KEY = "curta";
    expect(() => encryptToken("x")).toThrow();
    process.env.AGENDA_TOKEN_ENC_KEY = saved;
  });
});

describe("state do OAuth", () => {
  it("vai e volta com o closer", () => {
    expect(readState(createState(42))).toBe(42);
  });

  it("rejeita state forjado com outro segredo", () => {
    const forged = sign({ purpose: "agenda-google-oauth", closerId: 1 }, "outro");
    expect(() => readState(forged)).toThrow();
  });

  it("rejeita token valido de outra finalidade (ex.: login do usuario)", () => {
    const login = sign({ id: 1, profile: "admin" }, "segredo-de-teste");
    expect(() => readState(login)).toThrow();
  });

  it("rejeita lixo", () => {
    expect(() => readState("nao-e-jwt")).toThrow();
  });
});

describe("GoogleBusySource", () => {
  it("closer sem Google conectado: nao acrescenta nada", async () => {
    const client: any = { hasConnection: async () => false, freeBusy: jest.fn() };
    expect(await new GoogleBusySource(client).getBusy(closer, from, to)).toEqual([]);
    expect(client.freeBusy).not.toHaveBeenCalled();
  });

  it("converte o freeBusy do Google em intervalos", async () => {
    const client: any = {
      hasConnection: async () => true,
      freeBusy: async () => [
        { start: "2026-10-05T13:00:00Z", end: "2026-10-05T14:00:00Z" }
      ]
    };
    const busy = await new GoogleBusySource(client).getBusy(closer, from, to);
    expect(busy).toHaveLength(1);
    expect(busy[0].startsAt.toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });

  it("FALHA FECHADA: se o Google der erro, o periodo inteiro fica ocupado", async () => {
    const client: any = {
      hasConnection: async () => true,
      freeBusy: async () => {
        throw new Error("503");
      }
    };
    const busy = await new GoogleBusySource(client).getBusy(closer, from, to);
    expect(busy).toEqual([{ startsAt: from, endsAt: to }]);
  });
});

describe("GoogleEventSink", () => {
  const appointment: any = {
    id: 99,
    title: "Demo",
    description: "conversa inicial",
    attendeeEmail: "lead@x.com",
    externalId: "evt-1",
    startsAt: new Date("2026-10-05T13:00:00Z"),
    endsAt: new Date("2026-10-05T14:00:00Z")
  };

  it("cria o evento com horario, fuso, convidados e Meet", async () => {
    const insertEvent = jest.fn(async () => ({ id: "evt-1", hangoutLink: "https://meet.google.com/x" }));
    const client: any = { hasConnection: async () => true, insertEvent };

    const result = await new GoogleEventSink(client).onCreate(appointment, closer);

    expect(result).toEqual({ externalId: "evt-1", meetingUrl: "https://meet.google.com/x" });
    const [, body, sendUpdates] = insertEvent.mock.calls[0] as any[];
    expect(body.summary).toBe("Demo");
    expect(body.start).toEqual({ dateTime: "2026-10-05T13:00:00.000Z", timeZone: "America/Sao_Paulo" });
    expect(body.attendees).toEqual([{ email: "lead@x.com" }, { email: "closer@x.com" }]);
    expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe("hangoutsMeet");
    expect(body.extendedProperties.private.samachatAppointmentId).toBe("99");
    expect(sendUpdates).toBe("all");
  });

  it("closer sem Google conectado: nao cria nada la fora", async () => {
    const insertEvent = jest.fn();
    const client: any = { hasConnection: async () => false, insertEvent };
    expect(await new GoogleEventSink(client).onCreate(appointment, closer)).toBeUndefined();
    expect(insertEvent).not.toHaveBeenCalled();
  });

  it("remarcar altera so o horario do evento", async () => {
    const patchEvent = jest.fn(async () => undefined);
    const client: any = { hasConnection: async () => true, patchEvent };
    await new GoogleEventSink(client).onReschedule(appointment, closer);
    expect(patchEvent).toHaveBeenCalledWith(closer, "evt-1", expect.objectContaining({ start: expect.any(Object) }));
  });

  it("cancelar apaga o evento; sem externalId nao faz nada", async () => {
    const deleteEvent = jest.fn(async () => undefined);
    const client: any = { hasConnection: async () => true, deleteEvent };
    const sink = new GoogleEventSink(client);
    await sink.onCancel(appointment, closer);
    expect(deleteEvent).toHaveBeenCalledWith(closer, "evt-1");
    await sink.onCancel({ ...appointment, externalId: null }, closer);
    expect(deleteEvent).toHaveBeenCalledTimes(1);
  });
});
