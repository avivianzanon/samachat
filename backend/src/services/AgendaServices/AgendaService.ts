import AppError from "../../errors/AppError";
import AgendaAppointment from "../../models/AgendaAppointment";
import { getAgendaConfig } from "./AgendaConfigService";
import InternalAgendaProvider from "./InternalAgendaProvider";
import GoogleBusySource from "./google/GoogleBusySource";
import GoogleCalendarClient from "./google/GoogleCalendarClient";
import GoogleEventSink from "./google/GoogleEventSink";
import { isGoogleConfigured } from "./google/googleConfig";
import {
  AgendaProvider,
  CancelAppointmentInput,
  CreateAppointmentInput,
  ListSlotsInput,
  ListSlotsResult,
  RescheduleAppointmentInput
} from "./types";

// Fachada unica da agenda. O agente SDR (e qualquer outra parte do sistema)
// importa SO daqui e nunca sabe qual provedor esta por tras.
export const getAgendaProvider = async (): Promise<AgendaProvider> => {
  const { provider } = await getAgendaConfig();

  if (provider === "internal") return new InternalAgendaProvider();

  if (provider === "google") {
    // Sem credenciais, falha de forma explicita em vez de cair em silencio
    // na agenda interna (o admin acharia que o Google esta valendo).
    if (!isGoogleConfigured()) {
      throw new AppError("ERR_AGENDA_GOOGLE_NOT_CONFIGURED", 503);
    }
    const client = new GoogleCalendarClient();
    return new InternalAgendaProvider({
      name: "google",
      busySource: new GoogleBusySource(client),
      eventSink: new GoogleEventSink(client)
    });
  }

  throw new AppError("ERR_AGENDA_PROVIDER_NOT_AVAILABLE", 501);
};

export const listFreeSlots = async (
  input: ListSlotsInput
): Promise<ListSlotsResult> => (await getAgendaProvider()).listFreeSlots(input);

export const createAppointment = async (
  input: CreateAppointmentInput
): Promise<AgendaAppointment> =>
  (await getAgendaProvider()).createAppointment(input);

export const rescheduleAppointment = async (
  input: RescheduleAppointmentInput
): Promise<AgendaAppointment> =>
  (await getAgendaProvider()).rescheduleAppointment(input);

export const cancelAppointment = async (
  input: CancelAppointmentInput
): Promise<AgendaAppointment> =>
  (await getAgendaProvider()).cancelAppointment(input);
