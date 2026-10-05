import AppError from "../../errors/AppError";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { ChatMessage } from "./agentLoop";
import { createOpenAIChat, isOpenAIReady } from "./openAIChat";
import { converse } from "./RunSdrAgentService";
import { getSdrAgentSettings } from "./SdrAgentSettingsService";

interface Input {
  messages: { role: "user" | "assistant"; content: string }[];
  contactName?: string;
  contactNumber?: string;
}

// Ensaio SEM WhatsApp: voce manda o historico da conversa e recebe a resposta
// do agente (e as ferramentas que ele chamou). Nada e enviado a ninguem. As
// ferramentas de agenda sao REAIS (criam agendamento de verdade, no banco local),
// ligadas a um contato "[SIMULACAO]" para dar para remarcar e cancelar.
const SimulateSdrAgentService = async ({
  messages,
  contactName,
  contactNumber
}: Input) => {
  if (!(await isOpenAIReady())) {
    throw new AppError("ERR_OPENAI_INACTIVE", 400);
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new AppError("ERR_SDR_SIMULATE_NEEDS_USER_MESSAGE", 400);
  }

  const settings = await getSdrAgentSettings();
  const name = contactName || "Lead de teste";
  const number = contactNumber || "5500000000001";

  const contact = await CreateOrUpdateContactService({
    name: `[SIMULACAO] ${name}`,
    number,
    isGroup: false
  });

  const transfers: { reason: string; summary: string }[] = [];
  const history: ChatMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  const result = await converse({
    settings,
    history,
    contact: { name, number },
    chat: createOpenAIChat({
      model: settings.model,
      temperature: settings.temperature,
      contactId: contact.id
    }),
    toolContext: {
      contactId: contact.id,
      onTransfer: async args => {
        transfers.push(args);
      }
    }
  });

  return {
    reply: result.reply,
    toolCalls: result.toolCalls,
    transfers,
    rounds: result.rounds,
    totalTokens: result.totalTokens,
    contactId: contact.id
  };
};

export default SimulateSdrAgentService;
