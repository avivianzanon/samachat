import AgendaAppointment from "../../models/AgendaAppointment";
import AgendaCloser from "../../models/AgendaCloser";
import { BusyInterval } from "./slots";

export type AgendaProviderName = "internal" | "google";

export interface AgendaConfig {
  provider: AgendaProviderName;
  timezone: string;
  slotMinutes: number;
  minLeadMinutes: number;
  defaultDurationMinutes: number;
}

export interface ListSlotsInput {
  date: string; // AAAA-MM-DD no fuso da agenda
  durationMinutes?: number;
  closerId?: number;
}

export interface ListSlotsResult {
  date: string;
  isOpen: boolean;
  reason?: string;
  timezone: string;
  durationMinutes: number;
  slots: string[]; // "HH:mm" no fuso da agenda
}

export interface CreateAppointmentInput {
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  type?: string;
  description?: string;
  contactId?: number;
  ticketId?: number;
  attendeeEmail?: string;
  closerId?: number; // sem closerId: rodizio entre os livres
  metadata?: Record<string, unknown>;
}

// Localiza o agendamento por id ou, sem id, o proximo agendamento do contato
// (mesma regra da BIA: o mais proximo com status "scheduled").
export interface AppointmentRef {
  appointmentId?: number;
  contactId?: number;
}

export interface RescheduleAppointmentInput extends AppointmentRef {
  newDate: string;
  newTime: string;
  reason?: string;
}

export interface CancelAppointmentInput extends AppointmentRef {
  reason?: string;
}

// O agente so conhece esta interface. Quem a implementa (agenda interna,
// Google Calendar...) e escolhido por configuracao.
export interface AgendaProvider {
  readonly name: AgendaProviderName;
  listFreeSlots(input: ListSlotsInput): Promise<ListSlotsResult>;
  createAppointment(
    input: CreateAppointmentInput
  ): Promise<AgendaAppointment>;
  rescheduleAppointment(
    input: RescheduleAppointmentInput
  ): Promise<AgendaAppointment>;
  cancelAppointment(input: CancelAppointmentInput): Promise<AgendaAppointment>;
}

// Ganchos para provedores externos que espelham a agenda interna.
export interface BusySource {
  getBusy(closer: AgendaCloser, from: Date, to: Date): Promise<BusyInterval[]>;
}

export interface ExternalEventResult {
  externalId?: string;
  meetingUrl?: string;
}

export interface EventSink {
  onCreate(
    appointment: AgendaAppointment,
    closer: AgendaCloser
  ): Promise<ExternalEventResult | void>;
  onReschedule(
    appointment: AgendaAppointment,
    closer: AgendaCloser
  ): Promise<void>;
  onCancel(
    appointment: AgendaAppointment,
    closer: AgendaCloser | null
  ): Promise<void>;
}
