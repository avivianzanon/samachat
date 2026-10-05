import AgendaCloser from "../../../models/AgendaCloser";
import { logger } from "../../../utils/logger";
import { BusyInterval } from "../slots";
import { BusySource } from "../types";
import GoogleCalendarClient from "./GoogleCalendarClient";

// "Ja ocupado la fora": traz os compromissos do Google Calendar do closer.
// - Closer sem conta Google conectada: so vale a agenda interna.
// - Google fora do ar / erro: FALHA FECHADA. Devolve o periodo inteiro como
//   ocupado, para nao oferecer (nem reservar) horario que nao deu para
//   conferir e acabar em reuniao dupla.
export default class GoogleBusySource implements BusySource {
  private client: GoogleCalendarClient;

  constructor(client?: GoogleCalendarClient) {
    this.client = client || new GoogleCalendarClient();
  }

  async getBusy(
    closer: AgendaCloser,
    from: Date,
    to: Date
  ): Promise<BusyInterval[]> {
    if (!(await this.client.hasConnection(closer.id))) return [];

    try {
      const busy = await this.client.freeBusy(closer, from, to);
      return busy.map(b => ({
        startsAt: new Date(b.start),
        endsAt: new Date(b.end)
      }));
    } catch (err) {
      logger.warn(
        { err: err?.message, closerId: closer.id },
        "[agenda] Google freeBusy falhou; tratando o periodo como ocupado"
      );
      return [{ startsAt: from, endsAt: to }];
    }
  }
}
