import Message from "../../models/Message";
import SdrAgentSetting from "../../models/SdrAgentSetting";
import { logger } from "../../utils/logger";
import { sleep } from "../../utils/sleep";
import { getAgendaConfig } from "../AgendaServices/AgendaConfigService";
import CreateOpenAILogService from "../OpenAILogServices/CreateOpenAILogService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { AgentLoopResult, ChatFn, ChatMessage, runAgentLoop } from "./agentLoop";
import { createOpenAIChat } from "./openAIChat";
import { toChatHistory, splitReply } from "./conversation";
import { decideSdrReply } from "./policy";
import { renderPrompt } from "./promptTemplate";
import { effectivePrompt, getSdrAgentSettings } from "./SdrAgentSettingsService";
import { executeTool, TOOL_DEFINITIONS, ToolContext } from "./tools";

const CHUNK_DELAY_MS = 1200;

interface ConverseInput {
  settings: SdrAgentSetting;
  history: ChatMessage[];
  contact: { name?: string | null; number?: string | null };
  toolContext: ToolContext;
  chat: ChatFn;
}

// Monta o prompt, roda o laco do agente e devolve a resposta (nao envia nada).
export const converse = async ({
  settings,
  history,
  contact,
  toolContext,
  chat
}: ConverseInput): Promise<AgentLoopResult> => {
  const agenda = await getAgendaConfig();
  const system = renderPrompt(effectivePrompt(settings), {
    now: new Date(),
    timeZone: agenda.timezone,
    contactName: contact.name,
    contactNumber: contact.number,
    companyName: settings.companyName
  });

  return runAgentLoop({
    chat,
    messages: [{ role: "system", content: system }, ...history],
    tools: TOOL_DEFINITIONS,
    maxRounds: settings.maxToolRounds,
    runTool: (name, args) => executeTool(name, args, toolContext)
  });
};

const latestMessageId = async (ticketId: number): Promise<string | null> => {
  const last = await Message.findOne({
    where: { ticketId },
    order: [["createdAt", "DESC"]],
    attributes: ["id"]
  });
  return last ? last.id : null;
};

// Caminho de PRODUCAO: roda o agente para um ticket e responde no WhatsApp.
export const runSdrAgentForTicket = async (ticketId: number): Promise<void> => {
  const settings = await getSdrAgentSettings();
  const ticket = await ShowTicketService(ticketId);

  // Reconfere as travas na hora de rodar: durante a espera um atendente pode
  // ter assumido o ticket ou o agente ter sido desligado.
  const decision = decideSdrReply({
    settings,
    ticket,
    contactNumber: ticket.contact.number,
    fromMe: false,
    hasText: true
  });
  if (!decision.respond) {
    logger.info({ ticketId, reason: (decision as any).reason }, "[sdr] nao respondeu");
    return;
  }

  const rows = await Message.findAll({
    where: { ticketId },
    order: [["createdAt", "DESC"]],
    limit: settings.maxHistoryMessages
  });
  const history = toChatHistory(rows.reverse());
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return; // nada novo do lead para responder
  }

  const snapshotLast = await latestMessageId(ticketId);
  let transferred = false;

  try {
    const result = await converse({
      settings,
      history,
      contact: ticket.contact,
      chat: createOpenAIChat({
        model: settings.model,
        temperature: settings.temperature,
        ticketId,
        contactId: ticket.contactId
      }),
      toolContext: {
        contactId: ticket.contactId,
        ticketId,
        onTransfer: async ({ reason, summary }) => {
          transferred = true;
          await ticket.update({ sdrAgentEnabled: false, status: "pending" });
          await CreateOpenAILogService({
            action: "sdr_transfer",
            status: "success",
            response: summary,
            ticketId,
            contactId: ticket.contactId,
            metadata: { reason }
          });
        }
      }
    });

    if (!result.reply) {
      logger.warn({ ticketId }, "[sdr] modelo devolveu resposta vazia");
      return;
    }

    // Chegou mensagem nova (do lead ou de um atendente) enquanto o modelo
    // pensava: descarta esta resposta; a nova mensagem dispara outra execucao.
    if ((await latestMessageId(ticketId)) !== snapshotLast) {
      logger.info({ ticketId }, "[sdr] resposta descartada: conversa mudou durante a execucao");
      return;
    }

    const chunks = splitReply(result.reply);
    for (let i = 0; i < chunks.length; i += 1) {
      await SendWhatsAppMessage({ body: chunks[i], ticket });
      if (i < chunks.length - 1) await sleep(CHUNK_DELAY_MS);
    }
  } catch (err) {
    // Falhou (OpenAI fora, chave invalida...): tira o agente deste ticket para
    // um humano assumir pelo fluxo normal, em vez de deixar o lead sem resposta.
    logger.error({ err, ticketId }, "[sdr] falha; devolvendo o ticket para atendimento humano");
    if (!transferred) {
      await ticket.update({ sdrAgentEnabled: false, status: "pending" });
    }
  }
};
