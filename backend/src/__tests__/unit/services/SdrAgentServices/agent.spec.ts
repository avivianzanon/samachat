import AppError from "../../../../errors/AppError";
import { runAgentLoop, ChatFn } from "../../../../services/SdrAgentServices/agentLoop";
import { SdrScheduler } from "../../../../services/SdrAgentServices/scheduler";
import { splitReply, toChatHistory } from "../../../../services/SdrAgentServices/conversation";
import { executeTool } from "../../../../services/SdrAgentServices/tools";

jest.mock("../../../../services/AgendaServices/AgendaConfigService", () => ({
  getAgendaConfig: async () => ({ timezone: "America/Sao_Paulo" })
}));

const toolCall = (id: string, name: string, args: object) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) }
});

describe("runAgentLoop", () => {
  it("responde direto quando o modelo nao pede ferramenta", async () => {
    const chat: ChatFn = async () => ({ message: { role: "assistant", content: " Oi, Maria! " } });
    const r = await runAgentLoop({ chat, messages: [], tools: [], runTool: jest.fn(), maxRounds: 3 });
    expect(r.reply).toBe("Oi, Maria!");
    expect(r.toolCalls).toEqual([]);
    expect(r.rounds).toBe(1);
  });

  it("executa a ferramenta, devolve o resultado ao modelo e usa o texto final", async () => {
    const seen: any[] = [];
    const chat: ChatFn = async ({ messages }) => {
      seen.push(messages.map(m => m.role));
      return seen.length === 1
        ? { message: { role: "assistant", content: null, tool_calls: [toolCall("c1", "check_availability", { date: "2026-10-05" })] } }
        : { message: { role: "assistant", content: "Tenho 09:00 e 10:00." }, usage: { totalTokens: 7 } };
    };
    const runTool = jest.fn(async () => ({ available_slots: ["09:00", "10:00"] }));

    const r = await runAgentLoop({ chat, messages: [{ role: "user", content: "quero marcar" }], tools: [{}], runTool, maxRounds: 3 });

    expect(runTool).toHaveBeenCalledWith("check_availability", '{"date":"2026-10-05"}');
    expect(seen[1]).toEqual(["user", "assistant", "tool"]); // o resultado voltou para o modelo
    expect(r.reply).toBe("Tenho 09:00 e 10:00.");
    expect(r.toolCalls).toHaveLength(1);
    expect(r.totalTokens).toBe(7);
  });

  it("limite de rodadas: forca uma resposta final SEM ferramentas", async () => {
    const calls: boolean[] = [];
    const chat: ChatFn = async ({ tools }) => {
      calls.push(Boolean(tools));
      return tools
        ? { message: { role: "assistant", content: null, tool_calls: [toolCall("x", "check_availability", {})] } }
        : { message: { role: "assistant", content: "Vou te passar para a equipe." } };
    };
    const r = await runAgentLoop({ chat, messages: [], tools: [{}], runTool: async () => ({}), maxRounds: 2 });
    expect(calls).toEqual([true, true, false]);
    expect(r.reply).toBe("Vou te passar para a equipe.");
  });

  it("resposta vazia vira texto vazio (quem chama decide nao enviar)", async () => {
    const chat: ChatFn = async () => ({ message: { role: "assistant", content: null } });
    const r = await runAgentLoop({ chat, messages: [], tools: [], runTool: jest.fn(), maxRounds: 2 });
    expect(r.reply).toBe("");
  });
});

describe("SdrScheduler (agrupar mensagens e nao rodar em paralelo)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };

  it("varias mensagens seguidas geram UMA execucao", async () => {
    const runner = jest.fn(async () => undefined);
    const s = new SdrScheduler(runner);
    s.schedule(1, 5);
    jest.advanceTimersByTime(3000);
    s.schedule(1, 5); // chegou outra mensagem: reinicia a espera
    jest.advanceTimersByTime(3000);
    expect(runner).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    await flush();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(1);
  });

  it("mensagem nova durante a execucao roda de novo depois, nunca em paralelo", async () => {
    let release: () => void = () => undefined;
    let concurrent = 0;
    let maxConcurrent = 0;
    const runner = jest.fn(
      () =>
        new Promise<void>(resolve => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          release = () => {
            concurrent -= 1;
            resolve();
          };
        })
    );
    const s = new SdrScheduler(runner);

    s.schedule(7, 0);
    jest.advanceTimersByTime(0);
    await flush();
    s.schedule(7, 0); // chega mensagem enquanto o agente ainda roda
    jest.advanceTimersByTime(0);
    await flush();
    expect(runner).toHaveBeenCalledTimes(1);

    release();
    await flush();
    expect(runner).toHaveBeenCalledTimes(2);
    release();
    await flush();
    expect(maxConcurrent).toBe(1);
  });

  it("erro no agente nao trava o ticket: a proxima mensagem roda normalmente", async () => {
    const runner = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const s = new SdrScheduler(runner);
    s.schedule(3, 0);
    jest.advanceTimersByTime(0);
    await flush();
    s.schedule(3, 0);
    jest.advanceTimersByTime(0);
    await flush();
    expect(runner).toHaveBeenCalledTimes(2);
    expect(s.pending()).toBe(0);
  });

  it("tickets diferentes nao se atrapalham", async () => {
    const runner = jest.fn(async () => undefined);
    const s = new SdrScheduler(runner);
    s.schedule(1, 1);
    s.schedule(2, 1);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(runner).toHaveBeenCalledTimes(2);
  });
});

describe("conversation helpers", () => {
  it("histórico: lead = user, nossas mensagens = assistant, midia vira marca, vazio some", () => {
    const out = toChatHistory([
      { body: "oi", fromMe: false, mediaType: "chat" },
      { body: "Oi! Tudo bem?", fromMe: true, mediaType: "chat" },
      { body: "audio.ogg", fromMe: false, mediaType: "audio" },
      { body: "   ", fromMe: false, mediaType: "chat" }
    ]);
    expect(out).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "Oi! Tudo bem?" },
      { role: "user", content: "[o lead enviou audio; o conteudo nao pode ser lido]" }
    ]);
  });

  it("divide a resposta em ate 3 mensagens por paragrafo", () => {
    expect(splitReply("a\n\nb")).toEqual(["a", "b"]);
    expect(splitReply("a\n\nb\n\nc\n\nd\n\ne")).toEqual(["a", "b", "c\n\nd\n\ne"]);
    expect(splitReply("  \n\n ")).toEqual([]);
  });
});

describe("executeTool", () => {
  const appointment: any = {
    id: 5,
    title: "Reunião",
    durationMinutes: 60,
    status: "scheduled",
    startsAt: new Date("2026-10-05T13:00:00Z"),
    closer: { name: "Ana" },
    meetingUrl: "https://meet.google.com/x"
  };
  const agenda = (over: any = {}): any => ({
    listFreeSlots: jest.fn(async () => ({ date: "2026-10-05", isOpen: true, timezone: "America/Sao_Paulo", durationMinutes: 60, slots: ["09:00", "10:00"] })),
    createAppointment: jest.fn(async () => appointment),
    rescheduleAppointment: jest.fn(async () => appointment),
    cancelAppointment: jest.fn(async () => ({ ...appointment, status: "cancelled" })),
    ...over
  });
  const ctx = (a: any, extra: any = {}) => ({ contactId: 10, ticketId: 20, agenda: a, onTransfer: jest.fn(), ...extra });

  it("check_availability devolve so os horarios livres", async () => {
    const r: any = await executeTool("check_availability", '{"date":"2026-10-05"}', ctx(agenda()));
    expect(r.available_slots).toEqual(["09:00", "10:00"]);
    expect(r.note).toMatch(/APENAS/);
  });

  it("create_appointment liga ao contato/ticket, marca a origem e descreve o resultado no fuso da agenda", async () => {
    const a = agenda();
    const r: any = await executeTool("create_appointment", { title: "Reunião", date: "2026-10-05", time: "10:00", type: "meeting", email: "lead@x.com" }, ctx(a));
    expect(a.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ contactId: 10, ticketId: 20, attendeeEmail: "lead@x.com", metadata: { source: "sdr_agent" } }));
    expect(r.appointment).toMatchObject({ id: 5, date: "2026-10-05", time: "10:00", closer: "Ana" });
  });

  it("erro de negocio vira mensagem para o modelo (nao quebra a conversa)", async () => {
    const a = agenda({ createAppointment: jest.fn(async () => { throw new AppError("ERR_AGENDA_TIME_CONFLICT", 409); }) });
    const r: any = await executeTool("create_appointment", { title: "x", date: "2026-10-05", time: "10:00", type: "meeting" }, ctx(a));
    expect(r.error).toBe("ERR_AGENDA_TIME_CONFLICT");
    expect(r.message).toMatch(/check_availability/);
  });

  it("erro inesperado NAO vira texto: sobe para quem chamou", async () => {
    const a = agenda({ listFreeSlots: jest.fn(async () => { throw new Error("banco caiu"); }) });
    await expect(executeTool("check_availability", { date: "2026-10-05" }, ctx(a))).rejects.toThrow("banco caiu");
  });

  it("remarcar e cancelar usam o contato; sem contato devolvem erro", async () => {
    const a = agenda();
    await executeTool("reschedule_appointment", { new_date: "2026-10-06", new_time: "09:00" }, ctx(a));
    expect(a.rescheduleAppointment).toHaveBeenCalledWith(expect.objectContaining({ contactId: 10, newDate: "2026-10-06", newTime: "09:00" }));
    const c: any = await executeTool("cancel_appointment", {}, ctx(a));
    expect(c.appointment.status).toBe("cancelled");
    const none: any = await executeTool("cancel_appointment", {}, ctx(a, { contactId: null }));
    expect(none.error).toBe("missing_contact");
  });

  it("transfer_to_human aciona o callback com motivo e resumo", async () => {
    const onTransfer = jest.fn();
    await executeTool("transfer_to_human", { reason: "reclamacao", summary: "cliente irritado" }, ctx(agenda(), { onTransfer }));
    expect(onTransfer).toHaveBeenCalledWith({ reason: "reclamacao", summary: "cliente irritado" });
  });

  it("argumentos invalidos e ferramenta desconhecida nao explodem", async () => {
    const bad: any = await executeTool("check_availability", "{nao e json", ctx(agenda()));
    expect(bad.error).toBe("invalid_arguments");
    const unknown: any = await executeTool("apagar_tudo", {}, ctx(agenda()));
    expect(unknown.error).toBe("unknown_tool");
  });
});
