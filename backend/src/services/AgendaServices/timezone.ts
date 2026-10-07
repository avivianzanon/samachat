// Conversao de fuso sem depender do fuso do servidor.
// Logica portada da BIA SDR (bia-orchestrator): data/hora "de parede" no fuso
// da agenda <-> instante UTC. Resolve as bordas de horario de verao.

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const parseTimeToMinutes = (time: string): number => {
  const [hour, minute] = String(time).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

export const minutesToTime = (minutes: number): string => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const isValidDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export const isValidTime = (value: string): boolean =>
  /^\d{1,2}:\d{2}$/.test(value || "");

// Offset do fuso (em minutos) no instante `date`. Positivo a leste de Greenwich.
export const tzOffsetMinutes = (date: Date, timeZone: string): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const map: Record<string, string> = {};
  dtf.formatToParts(date).forEach(part => {
    map[part.type] = part.value;
  });
  const hour = map.hour === "24" ? "0" : map.hour;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - date.getTime()) / 60000;
};

// "2026-08-15" + "15:30" no fuso informado -> instante UTC correspondente.
export const zonedToUtc = (
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date => {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const [hour, minute] = String(timeStr).split(":").map(Number);
  const naive = Date.UTC(
    year,
    (month || 1) - 1,
    day || 1,
    hour || 0,
    minute || 0,
    0
  );
  const firstGuess = tzOffsetMinutes(new Date(naive), timeZone);
  let result = new Date(naive - firstGuess * 60000);
  const refined = tzOffsetMinutes(result, timeZone);
  if (refined !== firstGuess) {
    result = new Date(naive - refined * 60000);
  }
  return result;
};

// Dia da semana (0=domingo) de uma data ISO, sem depender do fuso do servidor.
export const weekdayOfDate = (dateStr: string): number =>
  new Date(`${dateStr}T00:00:00Z`).getUTCDay();

// Data e hora de parede de um instante, no fuso informado.
export const toZonedParts = (
  instant: Date,
  timeZone: string
): { date: string; time: string } => {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const map: Record<string, string> = {};
  dtf.formatToParts(instant).forEach(part => {
    map[part.type] = part.value;
  });
  const hour = map.hour === "24" ? "00" : map.hour;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}`
  };
};
