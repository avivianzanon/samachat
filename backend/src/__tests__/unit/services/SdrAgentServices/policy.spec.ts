import {
  decideSdrReply,
  numberAllowed,
  parseAllowedNumbers
} from "../../../../services/SdrAgentServices/policy";
import { renderPrompt } from "../../../../services/SdrAgentServices/promptTemplate";
import DEFAULT_SDR_PROMPT from "../../../../services/SdrAgentServices/defaultPrompt";

const on = { isEnabled: true, autoEnableForNewTickets: false, allowedNumbers: null };
const ticket = { isGroup: false, userId: null, sdrAgentEnabled: true };
const base = { settings: on, ticket, contactNumber: "5511999998888", fromMe: false, hasText: true };

describe("decideSdrReply (travas de seguranca)", () => {
  it("responde quando tudo esta ligado e o ticket esta marcado", () => {
    expect(decideSdrReply(base)).toEqual({ respond: true });
  });

  it("NAO responde com o agente desligado, mesmo com ticket marcado", () => {
    expect(decideSdrReply({ ...base, settings: { ...on, isEnabled: false } })).toEqual({
      respond: false,
      reason: "agente_desligado"
    });
  });

  it("nunca responde a mensagem propria, grupo ou sem texto", () => {
    expect(decideSdrReply({ ...base, fromMe: true }).respond).toBe(false);
    expect(decideSdrReply({ ...base, ticket: { ...ticket, isGroup: true } }).respond).toBe(false);
    expect(decideSdrReply({ ...base, hasText: false }).respond).toBe(false);
  });

  it("sai de cena quando um atendente humano assume, mesmo marcado", () => {
    expect(decideSdrReply({ ...base, ticket: { ...ticket, userId: 5 } })).toEqual({
      respond: false,
      reason: "atendente_humano"
    });
  });

  it("ticket sem marcacao so e atendido se a regra automatica estiver ligada", () => {
    const unmarked = { ...ticket, sdrAgentEnabled: null };
    expect(decideSdrReply({ ...base, ticket: unmarked }).respond).toBe(false);
    expect(
      decideSdrReply({ ...base, ticket: unmarked, settings: { ...on, autoEnableForNewTickets: true } }).respond
    ).toBe(true);
  });

  it("desligar no ticket vence a regra automatica", () => {
    expect(
      decideSdrReply({
        ...base,
        ticket: { ...ticket, sdrAgentEnabled: false },
        settings: { ...on, autoEnableForNewTickets: true }
      })
    ).toEqual({ respond: false, reason: "desligado_no_ticket" });
  });

  it("modo teste: so responde a numeros da lista", () => {
    const settings = { ...on, allowedNumbers: "11 99999-8888, 5521988887777" };
    expect(decideSdrReply({ ...base, settings }).respond).toBe(true);
    expect(decideSdrReply({ ...base, settings, contactNumber: "5531977776666" })).toEqual({
      respond: false,
      reason: "numero_fora_da_lista_de_teste"
    });
  });
});

describe("lista de numeros de teste", () => {
  it("normaliza, separa por virgula/ponto e virgula/linha e descarta fragmentos curtos", () => {
    expect(parseAllowedNumbers("(11) 99999-8888; 5521988887777\n+55 31 97777-6666, 11")).toEqual([
      "11999998888",
      "5521988887777",
      "5531977776666"
    ]);
  });

  it("lista vazia libera todos; numero vazio nao passa em lista preenchida", () => {
    expect(numberAllowed([], "123")).toBe(true);
    expect(numberAllowed(["11999998888"], "")).toBe(false);
  });
});

describe("renderPrompt", () => {
  const ctx = {
    now: new Date("2026-10-05T15:30:00Z"), // 12:30 em Sao Paulo, segunda-feira
    timeZone: "America/Sao_Paulo",
    contactName: "Maria",
    contactNumber: "5511999998888",
    companyName: "ARKOM"
  };

  it("preenche data, hora, dia da semana e dados do lead", () => {
    const out = renderPrompt(
      "{{ data_hora }} ({{ dia_semana }}) | {{data}} | {{ hora }} | {{ cliente_nome }} | {{ empresa }}",
      ctx
    );
    expect(out).toBe("05/10/2026 12:30 (segunda-feira) | 05/10/2026 | 12:30 | Maria | ARKOM");
  });

  it("mantem variavel desconhecida para o erro ficar visivel", () => {
    expect(renderPrompt("oi {{ nao_existe }}", ctx)).toBe("oi {{ nao_existe }}");
  });

  it("o prompt padrao da ARKOM carrega e usa as variaveis de data", () => {
    expect(DEFAULT_SDR_PROMPT).toContain("{{ data_hora }}");
    const out = renderPrompt(DEFAULT_SDR_PROMPT, ctx);
    expect(out).toContain("05/10/2026 12:30");
    expect(out).not.toContain("{{ data_hora }}");
    expect(out).toContain("ARKOM");
  });
});
