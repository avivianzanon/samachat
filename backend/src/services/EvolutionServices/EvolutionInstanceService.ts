import axios, { AxiosRequestConfig } from "axios";

import AppError from "../../errors/AppError";
import {
  getIntegrationConfig,
  patchIntegrationValues
} from "../IntegrationSettingsServices/IntegrationSettingsService";

// Gerencia as instancias (numeros de WhatsApp) direto na Evolution API, com as
// mesmas chamadas que a BIA usa. A fonte da verdade e a propria Evolution: nao
// guardamos copia no banco.

export type InstanceState = "connected" | "connecting" | "disconnected";

export interface EvolutionInstance {
  name: string;
  state: InstanceState;
  number: string | null;
  profileName: string | null;
}

const NAME_RE = /^[A-Za-z0-9_-]{3,40}$/;

export const assertInstanceName = (name: string): void => {
  if (!NAME_RE.test(String(name || ""))) {
    throw new AppError("ERR_EVOLUTION_INVALID_NAME", 400);
  }
};

// "open" e o estado de conectado na Evolution.
export const toState = (raw: unknown): InstanceState => {
  const s = String(raw || "").toLowerCase();
  if (s === "open" || s === "connected") return "connected";
  if (s === "connecting" || s === "qrcode" || s === "qr_required") return "connecting";
  return "disconnected";
};

const digitsOf = (jid: unknown): string | null => {
  const d = String(jid || "").split("@")[0].replace(/\D/g, "");
  return d || null;
};

// A Evolution v2 devolve campos no topo; a v1 aninha em "instance".
export const normalizeInstance = (item: any): EvolutionInstance => {
  const inner = item?.instance && typeof item.instance === "object" ? item.instance : item;
  return {
    name: String(inner?.name || inner?.instanceName || ""),
    state: toState(inner?.connectionStatus || inner?.state || inner?.status),
    number: digitsOf(inner?.ownerJid || inner?.owner || inner?.number),
    profileName: inner?.profileName ? String(inner.profileName) : null
  };
};

const mapError = (err: any): AppError => {
  const status = err?.response?.status;
  const message = JSON.stringify(err?.response?.data || "").toLowerCase();
  if (status === 401) return new AppError("ERR_EVOLUTION_UNAUTHORIZED", 401);
  if (status === 403 && /already in use|already exists/.test(message)) {
    return new AppError("ERR_EVOLUTION_NAME_IN_USE", 409);
  }
  if (status === 403) return new AppError("ERR_EVOLUTION_UNAUTHORIZED", 401);
  if (status === 404) return new AppError("ERR_EVOLUTION_NOT_FOUND", 404);
  if (status === 409) return new AppError("ERR_EVOLUTION_NAME_IN_USE", 409);
  if (status) return new AppError("ERR_EVOLUTION_REQUEST_FAILED", 502);
  return new AppError("ERR_EVOLUTION_UNREACHABLE", 502);
};

// Chamada autenticada na Evolution (usa o endereco e a chave ja salvos).
const call = async (config: AxiosRequestConfig): Promise<any> => {
  const { values } = await getIntegrationConfig("evolution");
  if (!values.apiUrl || !values.apiKey) {
    throw new AppError("ERR_EVOLUTION_NOT_CONFIGURED", 400);
  }
  try {
    const response = await axios.request({
      baseURL: values.apiUrl,
      timeout: 15000,
      ...config,
      headers: { apikey: values.apiKey, ...(config.headers || {}) }
    });
    return response.data;
  } catch (err) {
    throw mapError(err);
  }
};

// Nome amigavel e instancia padrao ficam na configuracao da Evolution (a Evolution
// em si so conhece o nome tecnico).
const readMeta = async (): Promise<{
  labels: Record<string, string>;
  defaultInstance: string;
}> => {
  const { values } = await getIntegrationConfig("evolution");
  let labels: Record<string, string> = {};
  try {
    const parsed = JSON.parse(values.instanceLabels || "{}");
    if (parsed && typeof parsed === "object") labels = parsed;
  } catch (err) {
    labels = {};
  }
  return { labels, defaultInstance: String(values.defaultInstance || "") };
};

const cleanLabel = (label: unknown): string => String(label || "").trim().slice(0, 60);

export interface ManagedInstance extends EvolutionInstance {
  label: string | null;
  isDefault: boolean;
}

export const listInstances = async (): Promise<ManagedInstance[]> => {
  const data = await call({ method: "GET", url: "/instance/fetchInstances" });
  const rows = Array.isArray(data) ? data : [];
  const { labels, defaultInstance } = await readMeta();
  return rows
    .map(normalizeInstance)
    .filter(i => i.name)
    .map(i => ({
      ...i,
      label: labels[i.name] || null,
      isDefault: i.name === defaultInstance
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Define qual instancia o chat usa por padrao (so uma).
export const setDefaultInstance = async (name: string): Promise<void> => {
  assertInstanceName(name);
  const all = await listInstances();
  if (!all.some(i => i.name === name)) {
    throw new AppError("ERR_EVOLUTION_NOT_FOUND", 404);
  }
  await patchIntegrationValues("evolution", { defaultInstance: name });
};

export const getInstanceState = async (name: string): Promise<InstanceState> => {
  assertInstanceName(name);
  const data = await call({
    method: "GET",
    url: `/instance/connectionState/${encodeURIComponent(name)}`
  });
  return toState(data?.instance?.state ?? data?.state);
};

export interface QrResult {
  connected: boolean;
  qr: string | null; // imagem pronta para <img src>
  pairingCode: string | null;
}

const asImage = (value: unknown): string | null => {
  const s = String(value || "");
  if (!s) return null;
  return s.startsWith("data:") ? s : `data:image/png;base64,${s}`;
};

// QR code para ler no WhatsApp (Aparelhos conectados). Se ja conectou, avisa.
export const getInstanceQr = async (name: string): Promise<QrResult> => {
  assertInstanceName(name);
  if ((await getInstanceState(name)) === "connected") {
    return { connected: true, qr: null, pairingCode: null };
  }
  const data = await call({
    method: "GET",
    url: `/instance/connect/${encodeURIComponent(name)}`
  });
  const connected =
    data?.instance?.state === "open" || data?.state === "open";
  return {
    connected,
    qr: connected ? null : asImage(data?.base64 || data?.qrcode?.base64),
    pairingCode: data?.pairingCode ? String(data.pairingCode) : null
  };
};

export const createInstance = async (
  name: string,
  opts: { label?: string; isDefault?: boolean } = {}
): Promise<{ name: string; qr: string | null; pairingCode: string | null }> => {
  assertInstanceName(name);
  const data = await call({
    method: "POST",
    url: "/instance/create",
    data: { instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS" }
  });

  let qr = asImage(data?.qrcode?.base64 || data?.hash?.qrcode);
  let pairingCode: string | null = data?.qrcode?.pairingCode
    ? String(data.qrcode.pairingCode)
    : null;

  // Guarda o nome amigavel e, se pedido (ou se for a primeira), a marca de padrao.
  const meta = await readMeta();
  const patch: Record<string, any> = {};
  const label = cleanLabel(opts.label);
  if (label) patch.instanceLabels = JSON.stringify({ ...meta.labels, [name]: label });
  if (opts.isDefault || !meta.defaultInstance) patch.defaultInstance = name;
  if (Object.keys(patch).length) await patchIntegrationValues("evolution", patch);

  // Algumas versoes nao devolvem o QR no create: busca em seguida.
  if (!qr) {
    try {
      const fetched = await getInstanceQr(name);
      qr = fetched.qr;
      pairingCode = pairingCode || fetched.pairingCode;
    } catch (err) {
      // a instancia foi criada; o QR pode ser pedido de novo pela tela
    }
  }
  return { name, qr, pairingCode };
};

// Desconecta o numero (a instancia continua existindo, sem WhatsApp ligado).
export const logoutInstance = async (name: string): Promise<void> => {
  assertInstanceName(name);
  await call({ method: "DELETE", url: `/instance/logout/${encodeURIComponent(name)}` });
};

export const deleteInstance = async (name: string): Promise<void> => {
  assertInstanceName(name);
  await call({ method: "DELETE", url: `/instance/delete/${encodeURIComponent(name)}` });

  // Limpa o que guardamos dela (nome amigavel e marca de padrao).
  const meta = await readMeta();
  const patch: Record<string, any> = {};
  if (meta.labels[name]) {
    const rest = { ...meta.labels };
    delete rest[name];
    patch.instanceLabels = JSON.stringify(rest);
  }
  if (meta.defaultInstance === name) patch.defaultInstance = "";
  if (Object.keys(patch).length) await patchIntegrationValues("evolution", patch);
};
