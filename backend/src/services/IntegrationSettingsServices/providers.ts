// Campos de cada integracao externa. `secret` = nunca volta inteiro para a tela
// (so "chave salva" e os 4 ultimos caracteres).
export type FieldKind = "string" | "number" | "boolean";

export interface FieldDef {
  key: string;
  kind: FieldKind;
  secret?: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
}

export const PROVIDERS: Record<string, FieldDef[]> = {
  // Voz das respostas em audio (a mesma da BIA).
  elevenlabs: [
    { key: "apiKey", kind: "string", secret: true },
    { key: "voiceId", kind: "string", default: "33B4UnXyTNbgLmdEDh5P" },
    { key: "model", kind: "string", default: "eleven_turbo_v2_5" },
    { key: "stability", kind: "number", default: 0.75, min: 0, max: 1 },
    { key: "similarityBoost", kind: "number", default: 0.8, min: 0, max: 1 },
    { key: "style", kind: "number", default: 0.3, min: 0, max: 1 },
    { key: "speakerBoost", kind: "boolean", default: true },
    { key: "audioReply", kind: "boolean", default: false }
  ],
  // Motores de IA para conversar com os leads (so um fica ativo; a OpenAI vive
  // em OpenAISetting e entra na mesma regra).
  gemini: [
    { key: "apiKey", kind: "string", secret: true },
    { key: "model", kind: "string", default: "gemini-3.5-flash" }
  ],
  claude: [
    { key: "apiKey", kind: "string", secret: true },
    { key: "model", kind: "string", default: "claude-sonnet-5-5" }
  ],
  // WhatsApp pela Evolution API.
  evolution: [
    { key: "apiUrl", kind: "string" },
    { key: "apiKey", kind: "string", secret: true },
    // Instancia que o chat usa por padrao e nomes amigaveis (JSON em texto).
    // Quem escreve e o gerenciador de instancias, nao o formulario de credenciais.
    { key: "defaultInstance", kind: "string" },
    { key: "instanceLabels", kind: "string", default: "{}" }
  ],
  // WhatsApp oficial (Cloud API da Meta).
  meta: [
    { key: "accessToken", kind: "string", secret: true },
    { key: "phoneNumberId", kind: "string" },
    { key: "businessAccountId", kind: "string" },
    { key: "verifyToken", kind: "string", secret: true },
    { key: "appSecret", kind: "string", secret: true }
  ]
};

export const isProvider = (value: string): boolean =>
  Object.prototype.hasOwnProperty.call(PROVIDERS, value);

export const defaultsFor = (provider: string): Record<string, any> => {
  const out: Record<string, any> = {};
  PROVIDERS[provider].forEach(field => {
    if (field.default !== undefined) out[field.key] = field.default;
  });
  return out;
};
