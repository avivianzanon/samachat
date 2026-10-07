import AppError from "../../errors/AppError";
import IntegrationSetting from "../../models/IntegrationSetting";
import { PROVIDERS, defaultsFor, isProvider } from "./providers";
import { activeEnginesExcept, isEngine } from "./activeEngines";

// Provedores que nao podem ficar ativos ao mesmo tempo.
export const EXCLUSIVE_GROUPS: string[][] = [["evolution", "meta"]];

// Tem o minimo para funcionar? (so entao pode ser ativado)
export const isConfigured = (
  provider: string,
  values: Record<string, any>
): boolean => {
  if (provider === "elevenlabs" || provider === "gemini" || provider === "claude") {
    return Boolean(values.apiKey);
  }
  if (provider === "evolution") return Boolean(values.apiUrl && values.apiKey);
  return Boolean(values.accessToken && values.phoneNumberId);
};

export interface IntegrationConfig {
  isActive: boolean;
  values: Record<string, any>;
}

const parse = (raw: string | null): Record<string, any> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
};

const assertProvider = (provider: string): void => {
  if (!isProvider(provider)) throw new AppError("ERR_INTEGRATION_UNKNOWN", 404);
};

// Configuracao COMPLETA (com segredos). Uso interno do backend: nunca devolver
// isto para a tela; use getPublicIntegration.
export const getIntegrationConfig = async (
  provider: string
): Promise<IntegrationConfig> => {
  assertProvider(provider);
  const row = await IntegrationSetting.findOne({ where: { provider } });
  return {
    isActive: row ? row.isActive : false,
    values: { ...defaultsFor(provider), ...parse(row ? row.config : null) }
  };
};

const hint = (secret: string): string =>
  secret.length > 4 ? `••••${secret.slice(-4)}` : "••••";

// O que a tela recebe: segredos nunca vao inteiros.
export const getPublicIntegration = async (provider: string) => {
  const { isActive, values } = await getIntegrationConfig(provider);
  const publicValues: Record<string, any> = {};
  const secrets: Record<string, { set: boolean; hint: string }> = {};

  PROVIDERS[provider].forEach(field => {
    const value = values[field.key];
    if (field.secret) {
      const set = Boolean(value);
      secrets[field.key] = { set, hint: set ? hint(String(value)) : "" };
    } else {
      publicValues[field.key] = value === undefined ? "" : value;
    }
  });

  return { provider, isActive, values: publicValues, secrets };
};

// Atualiza so alguns campos (nao-secretos) da configuracao, sem mexer em
// ativacao nem nas credenciais. Usado por quem gerencia dados derivados (ex.:
// instancia padrao da Evolution), para nao disputar com o formulario de chaves.
export const patchIntegrationValues = async (
  provider: string,
  patch: Record<string, any>
): Promise<void> => {
  assertProvider(provider);
  const allowed = PROVIDERS[provider].filter(f => !f.secret).map(f => f.key);
  const current = await getIntegrationConfig(provider);
  const next: Record<string, any> = { ...current.values };
  Object.keys(patch).forEach(key => {
    if (allowed.includes(key)) next[key] = patch[key];
  });

  const [row] = await IntegrationSetting.findOrCreate({
    where: { provider },
    defaults: { provider, isActive: current.isActive, config: JSON.stringify(next) }
  });
  await row.update({ config: JSON.stringify(next) });
};

interface UpdateInput {
  isActive?: boolean;
  values?: Record<string, any>;
  clearSecrets?: string[];
}

export const updateIntegration = async (
  provider: string,
  input: UpdateInput
) => {
  assertProvider(provider);
  const current = await getIntegrationConfig(provider);
  const next: Record<string, any> = { ...current.values };
  const incoming = input.values || {};

  PROVIDERS[provider].forEach(field => {
    const raw = incoming[field.key];

    if (field.secret) {
      if (input.clearSecrets && input.clearSecrets.includes(field.key)) {
        delete next[field.key];
        return;
      }
      // vazio = manter o que ja esta salvo
      if (typeof raw === "string" && raw.trim() !== "") {
        next[field.key] = raw.trim();
      }
      return;
    }

    if (raw === undefined) return;

    if (field.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new AppError("ERR_INTEGRATION_INVALID_VALUE");
      if (
        (field.min !== undefined && n < field.min) ||
        (field.max !== undefined && n > field.max)
      ) {
        throw new AppError("ERR_INTEGRATION_INVALID_VALUE");
      }
      next[field.key] = n;
    } else if (field.kind === "boolean") {
      next[field.key] = Boolean(raw);
    } else {
      next[field.key] = String(raw).trim();
    }
  });

  // Evolution: a URL precisa ser http(s), sem barra no final.
  if (provider === "evolution" && next.apiUrl) {
    if (!/^https?:\/\/[^\s]+$/i.test(next.apiUrl)) {
      throw new AppError("ERR_INTEGRATION_INVALID_URL");
    }
    next.apiUrl = String(next.apiUrl).replace(/\/+$/, "");
  }

  const isActive =
    typeof input.isActive === "boolean" ? input.isActive : current.isActive;

  // So ativa com as credenciais cadastradas.
  if (isActive && !isConfigured(provider, next)) {
    throw new AppError("ERR_INTEGRATION_NOT_CONFIGURED", 400);
  }

  // Canais de WhatsApp sao "um ou outro": nao ativa enquanto o outro estiver ativo
  // (quem quer trocar desativa primeiro o que esta ativo).
  if (isActive && !current.isActive) {
    const group = EXCLUSIVE_GROUPS.find(g => g.includes(provider));
    if (group) {
      const others = await IntegrationSetting.findAll({
        where: { provider: group.filter(p => p !== provider), isActive: true }
      });
      if (others.length > 0) {
        throw new AppError("ERR_INTEGRATION_CHANNEL_ACTIVE", 409);
      }
    }
  }

  // Motores de IA: so um ativo (inclui a OpenAI).
  if (isActive && !current.isActive && isEngine(provider)) {
    if ((await activeEnginesExcept(provider)).length > 0) {
      throw new AppError("ERR_AI_ENGINE_ACTIVE", 409);
    }
  }

  const [row] = await IntegrationSetting.findOrCreate({
    where: { provider },
    defaults: { provider, isActive, config: JSON.stringify(next) }
  });
  await row.update({ isActive, config: JSON.stringify(next) });

  return getPublicIntegration(provider);
};
