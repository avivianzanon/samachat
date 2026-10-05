import {
  minutesToTime,
  toZonedParts,
  zonedToUtc
} from "./timezone";

export interface TimeWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface ComputeFreeSlotsInput {
  date: string; // AAAA-MM-DD no fuso da agenda
  timeZone: string;
  windows: TimeWindow[]; // expediente do dia da semana (ja filtrado)
  busy: BusyInterval[];
  durationMinutes: number;
  stepMinutes: number;
  minLeadMinutes: number;
  now: Date;
}

// Slots livres ("HH:mm", fuso da agenda) em que a reuniao cabe inteira dentro
// do expediente, nao colide com nenhum compromisso e respeita a antecedencia
// minima. Mesma regra da BIA, mas comparando instantes (nao minutos soltos).
export const computeFreeSlots = ({
  date,
  timeZone,
  windows,
  busy,
  durationMinutes,
  stepMinutes,
  minLeadMinutes,
  now
}: ComputeFreeSlotsInput): string[] => {
  const earliest = now.getTime() + minLeadMinutes * 60000;
  const slots = new Set<string>();

  windows.forEach(window => {
    for (
      let start = window.startMinutes;
      start + durationMinutes <= window.endMinutes;
      start += stepMinutes
    ) {
      const time = minutesToTime(start);
      const startsAt = zonedToUtc(date, time, timeZone);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

      if (startsAt.getTime() < earliest) continue;

      const collides = busy.some(
        interval =>
          startsAt.getTime() < interval.endsAt.getTime() &&
          endsAt.getTime() > interval.startsAt.getTime()
      );
      if (collides) continue;

      slots.add(time);
    }
  });

  return Array.from(slots).sort();
};

// Data de parede de hoje no fuso da agenda (para rejeitar datas passadas).
export const todayInZone = (now: Date, timeZone: string): string =>
  toZonedParts(now, timeZone).date;
