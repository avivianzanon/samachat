import AppError from "../../errors/AppError";
import AgendaAppointment from "../../models/AgendaAppointment";
import { getAgendaConfig } from "./AgendaConfigService";
import InternalAgendaProvider from "./InternalAgendaProvider";
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

  // O provedor Google entra no proximo passo; ate la, configurar "google"
  // falha de forma explicita em vez de cair silenciosamente na agenda interna.
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
