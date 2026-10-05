import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { decideSdrReply } from "./policy";
import { getSdrAgentSettings } from "./SdrAgentSettingsService";

export type HandoffMode = "ai" | "human";

export interface HandoffState {
  mode: HandoffMode;
  // Por que o modo e esse (codigo da politica; a tela traduz para texto).
  reason: string | null;
  agentEnabled: boolean;
  hasPrompt: boolean;
  testMode: boolean;
}

// Quem esta atendendo ESTA conversa agora, pela mesma regra que o agente usa
// para decidir se responde (policy.ts): a tela nunca mostra algo diferente do
// que de fato acontece.
export const getHandoffState = async (ticketId: number): Promise<HandoffState> => {
  const settings = await getSdrAgentSettings();
  const ticket = await ShowTicketService(ticketId);

  const decision = decideSdrReply({
    settings,
    ticket,
    contactNumber: ticket.contact?.number,
    fromMe: false,
    hasText: true
  });

  return {
    mode: decision.respond ? "ai" : "human",
    reason: decision.respond ? null : (decision as any).reason,
    agentEnabled: settings.isEnabled,
    hasPrompt: Boolean(String(settings.systemPrompt || "").trim()),
    testMode: Boolean(settings.testMode)
  };
};

// Passa a conversa para a IA ou para um humano.
// - human: a IA para de responder neste atendimento (a equipe aceita e atende).
// - ai: a IA volta a responder; se um atendente estava com a conversa, ela sai
//   do nome dele e volta para "Aguardando".
export const setHandoff = async (
  ticketId: number,
  mode: HandoffMode
): Promise<HandoffState> => {
  const ticket = await ShowTicketService(ticketId);

  if (mode === "ai") {
    await ticket.update({ sdrAgentEnabled: true });
    await UpdateTicketService({
      ticketData: { status: "pending", userId: null as any },
      ticketId
    });
  } else if (mode === "human") {
    await ticket.update({ sdrAgentEnabled: false });
    await ticket.reload({ include: ["contact", "queue", "whatsapp", "user", "tags"] });
    getIO()
      .to(ticket.status)
      .to("notification")
      .to(String(ticket.id))
      .emit("ticket", { action: "update", ticket });
  } else {
    throw new AppError("ERR_SDR_INVALID_HANDOFF_MODE", 400);
  }

  return getHandoffState(ticketId);
};
