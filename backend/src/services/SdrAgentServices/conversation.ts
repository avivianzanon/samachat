import { ChatMessage } from "./agentLoop";

const MAX_CHUNKS = 3;

interface HistoryRow {
  body?: string | null;
  fromMe: boolean;
  mediaType?: string | null;
}

// Mensagens do lead viram "user"; as nossas (agente ou atendente) "assistant".
// Midia sem texto vira uma marca, para o modelo saber que algo foi enviado.
export const toChatHistory = (rows: HistoryRow[]): ChatMessage[] =>
  rows
    .map(m => {
      const isText = !m.mediaType || m.mediaType === "chat";
      const content = isText
        ? String(m.body || "").trim()
        : `[o lead enviou ${m.mediaType}; o conteudo nao pode ser lido]`;
      return {
        role: (m.fromMe ? "assistant" : "user") as "assistant" | "user",
        content
      };
    })
    .filter(m => m.content);

// "Paragrafo" por mensagem, no maximo MAX_CHUNKS (o resto vai junto na ultima).
export const splitReply = (reply: string): string[] => {
  const parts = reply
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length <= MAX_CHUNKS) return parts;
  return [
    ...parts.slice(0, MAX_CHUNKS - 1),
    parts.slice(MAX_CHUNKS - 1).join("\n\n")
  ];
};
