import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import AppError from "../../../errors/AppError";

// AES-256-GCM. A chave vem de AGENDA_TOKEN_ENC_KEY (64 caracteres hex = 32
// bytes). Sem ela nada e gravado: melhor falhar do que guardar token aberto.
const getKey = (): Buffer => {
  const hex = process.env.AGENDA_TOKEN_ENC_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new AppError("ERR_AGENDA_GOOGLE_NOT_CONFIGURED", 503);
  }
  return Buffer.from(hex, "hex");
};

export const encryptToken = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64")).join(".");
};

export const decryptToken = (encoded: string): string => {
  const [iv, tag, data] = encoded.split(".").map(p => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};
