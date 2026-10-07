import axios from "axios";
import AppError from "../../errors/AppError";
import { getIntegrationConfig } from "./IntegrationSettingsService";
import { synthesizeSpeech } from "./elevenlabs";
import { claudeChat, geminiChat } from "../AiEngineServices/engines";
import { isProvider } from "./providers";

export interface TestResult {
  ok: boolean;
  message: string;
  audioBase64?: string;
}

const failure = (err: any, labelRaw: string): TestResult => {
  const status = err?.response?.status;
  const label = labelRaw;
  const upper = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  if (status === 401 || status === 403) {
    return { ok: false, message: `${upper(label)} recusou a credencial (erro ${status}). Confira a chave.` };
  }
  if (status === 404) {
    return { ok: false, message: `${upper(label)} não encontrou o endereço ou o número informado (erro 404).` };
  }
  if (status === 400) {
    return { ok: false, message: `${upper(label)} não aceitou os dados (erro 400). Confira o token e o ID do número.` };
  }
  if (status) {
    return { ok: false, message: `${upper(label)} respondeu com erro ${status}.` };
  }
  return {
    ok: false,
    message: `Não consegui falar com ${label}. Confira o endereço e a internet.`
  };
};

// Testa a conexao de verdade, sem enviar mensagem a ninguem.
const TestIntegrationService = async (provider: string): Promise<TestResult> => {
  if (!isProvider(provider)) throw new AppError("ERR_INTEGRATION_UNKNOWN", 404);
  const { values } = await getIntegrationConfig(provider);

  if (provider === "elevenlabs") {
    if (!values.apiKey) return { ok: false, message: "Informe a chave da ElevenLabs e salve." };
    try {
      const audio = await synthesizeSpeech("Olá! Esta é a voz do seu agente.");
      return {
        ok: true,
        message: "ElevenLabs conectada. Ouça a voz abaixo.",
        audioBase64: audio.toString("base64")
      };
    } catch (err) {
      if (err instanceof AppError) {
        const map: Record<string, string> = {
          ERR_ELEVENLABS_UNAUTHORIZED: "A ElevenLabs recusou a chave. Confira e salve de novo.",
          ERR_ELEVENLABS_BAD_VOICE: "A voz ou o modelo informado não existe na sua conta.",
          ERR_ELEVENLABS_RATE_LIMIT: "Limite de uso da ElevenLabs atingido. Tente mais tarde.",
          ERR_ELEVENLABS_REQUEST_FAILED: "Não consegui falar com a ElevenLabs agora."
        };
        return { ok: false, message: map[err.message] || "Não foi possível testar a voz." };
      }
      throw err;
    }
  }

  if (provider === "gemini" || provider === "claude") {
    const name = provider === "gemini" ? "Gemini" : "Claude";
    if (!values.apiKey) return { ok: false, message: `Informe a chave do ${name} e salve.` };
    try {
      const chat = provider === "gemini" ? geminiChat : claudeChat;
      const reply = await chat(
        values,
        { maxTokens: 20, temperature: 0, action: "test" },
        { messages: [{ role: "user", content: "Responda apenas: OK" }] }
      );
      return {
        ok: true,
        message: `${name} conectado (modelo ${reply.model || values.model}). Resposta: ${String(
          reply.message.content || "OK"
        ).slice(0, 40)}`
      };
    } catch (err) {
      if (err instanceof AppError) {
        const map: Record<string, string> = {
          ERR_AI_UNAUTHORIZED: `O ${name} recusou a chave. Confira e salve de novo.`,
          ERR_AI_MODEL_NOT_FOUND: "Esse modelo não existe para a sua chave. Escolha outro.",
          ERR_AI_RATE_LIMIT: `Limite de uso do ${name} atingido. Tente mais tarde.`,
          ERR_AI_BAD_REQUEST: `O ${name} não aceitou o pedido. Confira a chave e o modelo.`,
          ERR_AI_UPSTREAM: `O ${name} está instável agora. Tente de novo.`,
          ERR_AI_REQUEST_FAILED: `Não consegui falar com o ${name}. Confira a internet.`
        };
        return { ok: false, message: map[err.message] || `Não foi possível testar o ${name}.` };
      }
      throw err;
    }
  }

  if (provider === "evolution") {
    if (!values.apiUrl || !values.apiKey) {
      return { ok: false, message: "Informe o endereço e a chave da Evolution e salve." };
    }
    try {
      const { data } = await axios.get(`${values.apiUrl}/instance/fetchInstances`, {
        headers: { apikey: values.apiKey },
        timeout: 12000
      });
      const count = Array.isArray(data) ? data.length : 0;
      return { ok: true, message: `Evolution conectada. ${count} instância(s) encontrada(s).` };
    } catch (err) {
      return failure(err, "a Evolution");
    }
  }

  // meta
  if (!values.accessToken || !values.phoneNumberId) {
    return { ok: false, message: "Informe o token de acesso e o ID do número e salve." };
  }
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(values.phoneNumberId)}`,
      {
        params: { fields: "display_phone_number,verified_name" },
        headers: { Authorization: `Bearer ${values.accessToken}` },
        timeout: 12000
      }
    );
    const label = [data.verified_name, data.display_phone_number].filter(Boolean).join(" · ");
    return { ok: true, message: `WhatsApp oficial conectado${label ? `: ${label}` : ""}.` };
  } catch (err) {
    return failure(err, "a Meta");
  }
};

export default TestIntegrationService;
