import AppError from "../../errors/AppError";
import { activeEnginesExcept } from "../IntegrationSettingsServices/activeEngines";
import OpenAISetting from "../../models/OpenAISetting";
import GetOpenAISettingsService from "./GetOpenAISettingsService";

interface Request {
  apiKey?: string | null;
  isActive?: boolean;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  systemPrompt?: string | null;
  suggestionPrompt?: string | null;
  rewritePrompt?: string | null;
  summaryPrompt?: string | null;
  classificationPrompt?: string | null;
  autoReplyEnabled?: boolean;
  autoReplyPrompt?: string | null;
  maxRequestsPerDay?: number | null;
  maxRequestsPerHour?: number | null;
}

const UpdateOpenAISettingsService = async (
  data: Request
): Promise<OpenAISetting> => {
  const settings = await GetOpenAISettingsService();

  const updatePayload: Partial<OpenAISetting> = {
    isActive: data.isActive ?? settings.isActive,
    model: data.model ?? settings.model,
    temperature: data.temperature ?? settings.temperature,
    topP: data.topP ?? settings.topP,
    maxTokens: data.maxTokens ?? settings.maxTokens,
    presencePenalty: data.presencePenalty ?? settings.presencePenalty,
    frequencyPenalty: data.frequencyPenalty ?? settings.frequencyPenalty,
    systemPrompt: data.systemPrompt ?? settings.systemPrompt,
    suggestionPrompt: data.suggestionPrompt ?? settings.suggestionPrompt,
    rewritePrompt: data.rewritePrompt ?? settings.rewritePrompt,
    summaryPrompt: data.summaryPrompt ?? settings.summaryPrompt,
    classificationPrompt: data.classificationPrompt ?? settings.classificationPrompt,
    autoReplyEnabled: data.autoReplyEnabled ?? settings.autoReplyEnabled,
    autoReplyPrompt: data.autoReplyPrompt ?? settings.autoReplyPrompt,
    maxRequestsPerDay:
      data.maxRequestsPerDay !== undefined
        ? data.maxRequestsPerDay
        : settings.maxRequestsPerDay,
    maxRequestsPerHour:
      data.maxRequestsPerHour !== undefined
        ? data.maxRequestsPerHour
        : settings.maxRequestsPerHour
  };

  if (data.apiKey !== undefined) {
    updatePayload.apiKey = data.apiKey || null;
  }

  // So fica ativa com uma chave cadastrada.
  const finalKey =
    data.apiKey !== undefined ? data.apiKey || null : settings.apiKey;
  if (updatePayload.isActive && !finalKey) {
    throw new AppError("ERR_OPENAI_ACTIVE_NEEDS_KEY", 400);
  }

  // Motor de IA: so um ativo (Gemini e Claude entram na mesma regra).
  if (updatePayload.isActive && !settings.isActive) {
    if ((await activeEnginesExcept("openai")).length > 0) {
      throw new AppError("ERR_AI_ENGINE_ACTIVE", 409);
    }
  }

  await settings.update(updatePayload);

  return settings;
};

export default UpdateOpenAISettingsService;
