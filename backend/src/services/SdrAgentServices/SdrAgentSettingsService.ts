import AppError from "../../errors/AppError";
import SdrAgentSetting from "../../models/SdrAgentSetting";
import DEFAULT_SDR_PROMPT from "./defaultPrompt";

export interface SdrAgentSettingsData {
  isEnabled?: boolean;
  autoEnableForNewTickets?: boolean;
  allowedNumbers?: string | null;
  agentName?: string;
  companyName?: string;
  systemPrompt?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxHistoryMessages?: number;
  maxToolRounds?: number;
  replyDelaySeconds?: number;
}

const ensureRow = async (): Promise<SdrAgentSetting> => {
  const [row] = await SdrAgentSetting.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 } as any
  });
  return row;
};

export const getSdrAgentSettings = (): Promise<SdrAgentSetting> => ensureRow();

// Prompt efetivo: o salvo na configuracao ou, se vazio, o padrao da ARKOM.
export const effectivePrompt = (row: SdrAgentSetting): string =>
  row.systemPrompt && row.systemPrompt.trim()
    ? row.systemPrompt
    : DEFAULT_SDR_PROMPT;

const inRange = (value: number, min: number, max: number, code: string) => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new AppError(code, 400);
  }
};

export const updateSdrAgentSettings = async (
  data: SdrAgentSettingsData
): Promise<SdrAgentSetting> => {
  const row = await ensureRow();
  const patch: SdrAgentSettingsData = { ...data };

  if (data.maxHistoryMessages !== undefined) {
    inRange(data.maxHistoryMessages, 2, 100, "ERR_SDR_INVALID_HISTORY");
  }
  if (data.maxToolRounds !== undefined) {
    inRange(data.maxToolRounds, 1, 10, "ERR_SDR_INVALID_TOOL_ROUNDS");
  }
  if (data.replyDelaySeconds !== undefined) {
    inRange(data.replyDelaySeconds, 0, 60, "ERR_SDR_INVALID_DELAY");
  }
  if (data.temperature !== undefined && data.temperature !== null) {
    inRange(data.temperature, 0, 2, "ERR_SDR_INVALID_TEMPERATURE");
  }
  if (data.agentName !== undefined && !data.agentName.trim()) {
    throw new AppError("ERR_SDR_INVALID_NAME", 400);
  }

  // Texto vazio volta a significar "usar o padrao".
  if (patch.systemPrompt !== undefined && !String(patch.systemPrompt || "").trim()) {
    patch.systemPrompt = null;
  }
  if (patch.allowedNumbers !== undefined && !String(patch.allowedNumbers || "").trim()) {
    patch.allowedNumbers = null;
  }

  await row.update(patch as any);
  return row;
};
