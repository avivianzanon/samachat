import AppError from "../../errors/AppError";
import AgendaSetting from "../../models/AgendaSetting";
import { AgendaConfig, AgendaProviderName } from "./types";
import { DEFAULT_TIMEZONE } from "./timezone";

const PROVIDERS: AgendaProviderName[] = ["internal", "google"];

const isValidTimezone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (err) {
    return false;
  }
};

const toConfig = (row: AgendaSetting): AgendaConfig => ({
  provider: (PROVIDERS.includes(row.provider as AgendaProviderName)
    ? row.provider
    : "internal") as AgendaProviderName,
  timezone: row.timezone || DEFAULT_TIMEZONE,
  slotMinutes: row.slotMinutes || 30,
  minLeadMinutes: row.minLeadMinutes ?? 30,
  defaultDurationMinutes: row.defaultDurationMinutes || 60
});

const ensureRow = async (): Promise<AgendaSetting> => {
  const [row] = await AgendaSetting.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 } as any
  });
  return row;
};

export const getAgendaConfig = async (): Promise<AgendaConfig> =>
  toConfig(await ensureRow());

export const updateAgendaConfig = async (
  data: Partial<AgendaConfig>
): Promise<AgendaConfig> => {
  const row = await ensureRow();
  const patch: Partial<AgendaConfig> = {};

  if (data.provider !== undefined) {
    if (!PROVIDERS.includes(data.provider)) {
      throw new AppError("ERR_AGENDA_INVALID_PROVIDER", 400);
    }
    patch.provider = data.provider;
  }
  if (data.timezone !== undefined) {
    if (!isValidTimezone(data.timezone)) {
      throw new AppError("ERR_AGENDA_INVALID_TIMEZONE", 400);
    }
    patch.timezone = data.timezone;
  }
  if (data.slotMinutes !== undefined) {
    if (data.slotMinutes < 5 || data.slotMinutes > 240) {
      throw new AppError("ERR_AGENDA_INVALID_SLOT", 400);
    }
    patch.slotMinutes = data.slotMinutes;
  }
  if (data.minLeadMinutes !== undefined) {
    if (data.minLeadMinutes < 0 || data.minLeadMinutes > 7 * 24 * 60) {
      throw new AppError("ERR_AGENDA_INVALID_LEAD", 400);
    }
    patch.minLeadMinutes = data.minLeadMinutes;
  }
  if (data.defaultDurationMinutes !== undefined) {
    if (data.defaultDurationMinutes < 15 || data.defaultDurationMinutes > 480) {
      throw new AppError("ERR_AGENDA_INVALID_DURATION", 400);
    }
    patch.defaultDurationMinutes = data.defaultDurationMinutes;
  }

  await row.update(patch);
  return toConfig(row);
};
