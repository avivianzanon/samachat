import { computeFreeSlots } from "../../../../services/AgendaServices/slots";
import {
  zonedToUtc,
  toZonedParts,
  weekdayOfDate
} from "../../../../services/AgendaServices/timezone";

const TZ = "America/Sao_Paulo";
const base = {
  date: "2026-10-05", // segunda-feira
  timeZone: TZ,
  windows: [{ startMinutes: 9 * 60, endMinutes: 12 * 60 }],
  busy: [],
  durationMinutes: 60,
  stepMinutes: 30,
  minLeadMinutes: 30
};

describe("timezone", () => {
  it("converte hora de parede de Sao Paulo para UTC (UTC-3)", () => {
    expect(zonedToUtc("2026-10-05", "09:00", TZ).toISOString()).toBe(
      "2026-10-05T12:00:00.000Z"
    );
  });

  it("faz o caminho de volta", () => {
    expect(toZonedParts(new Date("2026-10-05T12:00:00Z"), TZ)).toEqual({
      date: "2026-10-05",
      time: "09:00"
    });
  });

  it("calcula o dia da semana sem depender do fuso do servidor", () => {
    expect(weekdayOfDate("2026-10-05")).toBe(1);
  });
});

describe("computeFreeSlots", () => {
  const now = new Date("2026-10-01T12:00:00Z"); // bem antes do dia testado

  it("gera slots de 30 em 30 que cabem inteiros no expediente", () => {
    expect(computeFreeSlots({ ...base, now })).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00"
    ]);
  });

  it("remove slots que colidem com compromissos", () => {
    const busy = [
      {
        startsAt: zonedToUtc("2026-10-05", "10:00", TZ),
        endsAt: zonedToUtc("2026-10-05", "11:00", TZ)
      }
    ];
    expect(computeFreeSlots({ ...base, busy, now })).toEqual([
      "09:00",
      "11:00"
    ]);
  });

  it("descarta horarios que ja passaram ou estao dentro da antecedencia", () => {
    // 09:40 em Sao Paulo (12:40Z) + 30 min de antecedencia => so a partir de 10:30
    const lateNow = new Date("2026-10-05T12:40:00Z");
    expect(computeFreeSlots({ ...base, now: lateNow })).toEqual([
      "10:30",
      "11:00"
    ]);
  });

  it("une janelas de varios closers sem duplicar horarios", () => {
    const windows = [
      { startMinutes: 9 * 60, endMinutes: 10 * 60 },
      { startMinutes: 9 * 60, endMinutes: 11 * 60 }
    ];
    expect(computeFreeSlots({ ...base, windows, now })).toEqual([
      "09:00",
      "09:30",
      "10:00"
    ]);
  });

  it("devolve vazio sem expediente", () => {
    expect(computeFreeSlots({ ...base, windows: [], now })).toEqual([]);
  });
});
