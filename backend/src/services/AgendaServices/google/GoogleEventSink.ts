import { randomUUID } from "crypto";
import AgendaAppointment from "../../../models/AgendaAppointment";
import AgendaCloser from "../../../models/AgendaCloser";
import { getAgendaConfig } from "../AgendaConfigService";
import { EventSink, ExternalEventResult } from "../types";
import GoogleCalendarClient from "./GoogleCalendarClient";

// Espelha no Google Calendar do closer o que acontece na agenda do SamaChat.
export default class GoogleEventSink implements EventSink {
  private client: GoogleCalendarClient;

  constructor(client?: GoogleCalendarClient) {
    this.client = client || new GoogleCalendarClient();
  }

  private times(appointment: AgendaAppointment, timeZone: string) {
    return {
      start: {
        dateTime: new Date(appointment.startsAt).toISOString(),
        timeZone
      },
      end: { dateTime: new Date(appointment.endsAt).toISOString(), timeZone }
    };
  }

  async onCreate(
    appointment: AgendaAppointment,
    closer: AgendaCloser
  ): Promise<ExternalEventResult | void> {
    if (!(await this.client.hasConnection(closer.id))) return undefined;

    const { timezone } = await getAgendaConfig();
    const attendees = [appointment.attendeeEmail, closer.email]
      .filter(Boolean)
      .map(email => ({ email }));

    const event = await this.client.insertEvent(
      closer,
      {
        summary: appointment.title,
        description: appointment.description || undefined,
        ...this.times(appointment, timezone),
        attendees: attendees.length ? attendees : undefined,
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        },
        extendedProperties: {
          private: { samachatAppointmentId: String(appointment.id) }
        }
      },
      appointment.attendeeEmail ? "all" : "none"
    );

    return { externalId: event.id, meetingUrl: event.hangoutLink };
  }

  async onReschedule(
    appointment: AgendaAppointment,
    closer: AgendaCloser
  ): Promise<void> {
    if (!appointment.externalId) return;
    if (!(await this.client.hasConnection(closer.id))) return;

    const { timezone } = await getAgendaConfig();
    await this.client.patchEvent(
      closer,
      appointment.externalId,
      this.times(appointment, timezone)
    );
  }

  async onCancel(
    appointment: AgendaAppointment,
    closer: AgendaCloser | null
  ): Promise<void> {
    if (!appointment.externalId || !closer) return;
    if (!(await this.client.hasConnection(closer.id))) return;

    await this.client.deleteEvent(closer, appointment.externalId);
  }
}
