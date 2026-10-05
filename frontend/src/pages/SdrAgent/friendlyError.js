import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

// Mensagens em portugues para os erros mais comuns da tela de treinamento.
const MESSAGES = {
  ERR_OPENAI_INACTIVE:
    "A OpenAI esta desativada. Ative em Configuracoes > IA e salve.",
  ERR_OPENAI_NO_API_KEY:
    "Falta a chave da OpenAI. Cole em Configuracoes > IA e salve.",
  ERR_OPENAI_UNAUTHORIZED: "A OpenAI recusou a chave. Confira se ela esta correta.",
  ERR_OPENAI_RATE_LIMIT: "Limite da OpenAI atingido. Tente de novo em instantes.",
  ERR_SDR_KB_EMPTY: "O documento esta vazio.",
  ERR_SDR_KB_NAME_REQUIRED: "De um nome ao documento.",
  ERR_SDR_KB_TOO_LARGE: "Documento grande demais. Divida em partes menores.",
  ERR_SDR_KB_NOT_FOUND: "Documento nao encontrado (ja foi removido?)."
};

export const friendlyError = err => {
  const code = err && err.response && err.response.data && err.response.data.error;
  if (code && MESSAGES[code]) {
    toast.error(MESSAGES[code], { toastId: code });
    return;
  }
  toastError(err);
};

export default friendlyError;
