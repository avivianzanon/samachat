export interface PolicySettings {
  isEnabled: boolean;
  autoEnableForNewTickets: boolean;
  allowedNumbers?: string | null;
}

export interface PolicyTicket {
  isGroup: boolean;
  userId?: number | null; // atendente humano que assumiu
  sdrAgentEnabled?: boolean | null;
}

export type PolicyDecision =
  | { respond: true }
  | { respond: false; reason: string };

const digits = (value?: string | null): string =>
  String(value || "").replace(/\D/g, "");

const MIN_DIGITS = 8;

// So virgula, ponto e virgula e quebra de linha separam numeros (espaco faz
// parte do numero: "11 99999-8888"). Entradas curtas demais sao descartadas:
// um pedaco como "11" liberaria todo numero que termina assim.
export const parseAllowedNumbers = (raw?: string | null): string[] =>
  String(raw || "")
    .split(/[,;\r\n]+/)
    .map(digits)
    .filter(d => d.length >= MIN_DIGITS);

// O telefone esta na lista de teste? Compara pelo final do numero, para
// aceitar com ou sem DDI/9o digito (ex.: 5511999998888 x 11999998888).
export const numberAllowed = (
  allowed: string[],
  contactNumber?: string | null
): boolean => {
  if (allowed.length === 0) return true;
  const n = digits(contactNumber);
  if (n.length < MIN_DIGITS) return false;
  return allowed.some(a => n.endsWith(a) || a.endsWith(n));
};

// Decide se o agente SDR deve responder a ESTA mensagem. Todas as travas de
// seguranca ficam aqui, num lugar so e sem tocar em banco: o padrao e NAO
// responder.
export const decideSdrReply = (input: {
  settings: PolicySettings;
  ticket: PolicyTicket;
  contactNumber?: string | null;
  fromMe: boolean;
  hasText: boolean;
}): PolicyDecision => {
  const { settings, ticket, contactNumber, fromMe, hasText } = input;

  if (!settings.isEnabled) return { respond: false, reason: "agente_desligado" };
  if (fromMe) return { respond: false, reason: "mensagem_propria" };
  if (ticket.isGroup) return { respond: false, reason: "grupo" };
  if (!hasText) return { respond: false, reason: "sem_texto" };

  // Humano assumiu: o agente sai de cena, mesmo se estiver marcado.
  if (ticket.userId) return { respond: false, reason: "atendente_humano" };

  if (ticket.sdrAgentEnabled === false) {
    return { respond: false, reason: "desligado_no_ticket" };
  }
  const on =
    ticket.sdrAgentEnabled === true || settings.autoEnableForNewTickets;
  if (!on) return { respond: false, reason: "ticket_nao_marcado" };

  if (!numberAllowed(parseAllowedNumbers(settings.allowedNumbers), contactNumber)) {
    return { respond: false, reason: "numero_fora_da_lista_de_teste" };
  }

  return { respond: true };
};
