import { EventEmitter } from "events";
import AgendaAppointment from "../../models/AgendaAppointment";

export type AgendaEventType =
  | "no_show"
  | "completed"
  | "cancelled"
  | "rescheduled";

export interface AgendaDomainEvent {
  type: AgendaEventType;
  appointment: AgendaAppointment;
  reason?: string;
}

// Barramento interno: quem precisar reagir a um evento da agenda (por exemplo
// o agente SDR retomando o contato apos um no-show) assina aqui:
//   agendaEvents.on("agenda.event", (e: AgendaDomainEvent) => ...)
// O endpoint de eventos externos nao depende de ninguem estar escutando.
export const agendaEvents = new EventEmitter();
export const AGENDA_EVENT = "agenda.event";
