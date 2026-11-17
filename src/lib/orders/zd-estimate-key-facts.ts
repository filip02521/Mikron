/**
 * Panel najważniejszych faktów Kreatora ZD (pod nagłówkiem): kiedy kolejne zamówienie, co ile zamawiamy,
 * jaki zapas i czy wystarczy do kolejnej dostawy. Czyste funkcje na kluczach dat YYYY-MM-DD.
 */
import { formatAutomatDay } from "@/lib/orders/zd-automat-daily";
import type { OrderInterval } from "@/lib/orders/dates";

export type ZdNextOrderFact =
  | { kind: "on_demand" }
  | { kind: "none" }
  | {
      kind: "planned";
      date: string;
      /** Dni od dziś; ujemne = zaległe. */
      days: number;
      /** „dziś”, „jutro”, „pt 13.11”. */
      label: string;
    };

const dayNum = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** Kolejne zamówienie z harmonogramu dostawcy (data z planu OnTime), bez zgadywania z interwału. */
export function zdNextOrderFact(input: { todayKey: string; computedNextDate: string | null; onDemand: boolean }): ZdNextOrderFact {
  if (input.onDemand) return { kind: "on_demand" };
  const date = input.computedNextDate?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "none" };
  return { kind: "planned", date, days: Math.round(dayNum(date) - dayNum(input.todayKey)), label: formatAutomatDay(date, input.todayKey) };
}

/** „za 4 dni”, „dziś składamy”, „zaległe 3 dni”. */
export function zdNextOrderDistance(days: number): string {
  if (days === 0) return "zamówienie na dziś";
  if (days > 0) return `za ${days} ${days === 1 ? "dzień" : "dni"}`;
  const late = -days;
  return `zaległe ${late} ${late === 1 ? "dzień" : "dni"}`;
}

/** Interwał w dniach (tygodnie × 7, miesiące × 30) — do porównania z zapasem. */
export function zdIntervalDays(interval: OrderInterval | null): number | null {
  if (!interval || !(interval.value > 0)) return null;
  return interval.unit === "weeks" ? interval.value * 7 : interval.value * 30;
}

/** „co tydzień”, „co 2 tyg.”, „co miesiąc”, „co 3 mies.”. */
export function zdIntervalLabel(interval: OrderInterval | null): string | null {
  if (!interval || !(interval.value > 0)) return null;
  if (interval.unit === "weeks") return interval.value === 1 ? "co tydzień" : `co ${interval.value} tyg.`;
  return interval.value === 1 ? "co miesiąc" : `co ${interval.value} mies.`;
}

/**
 * Czy zamówienie złożone dziś ma starczyć do przyjazdu kolejnej dostawy: do kolejnego zamówienia
 * (z planu; gdy plan wypada dziś lub jest zaległy — dziś składamy to zamówienie, kolejne za interwał) plus czas dostawy.
 * null = brak danych (na żądanie, bez planu i interwału).
 */
export function zdCoverageNeed(input: {
  next: ZdNextOrderFact;
  interval: OrderInterval | null;
  leadDays: number | null;
  stockDays: number;
}): { needDays: number; untilNextDays: number; short: boolean } | null {
  if (input.next.kind === "on_demand") return null;
  const intervalDays = zdIntervalDays(input.interval);
  const untilNext = input.next.kind === "planned" && input.next.days > 0 ? input.next.days : intervalDays;
  if (untilNext == null) return null;
  const needDays = untilNext + Math.max(0, input.leadDays ?? 0);
  return { needDays, untilNextDays: untilNext, short: Number.isFinite(input.stockDays) && input.stockDays > 0 && input.stockDays < needDays };
}

/** Szybki wybór zapasu: typowe wartości kart dostawców, plus bieżąca, gdy jej nie ma na liście. */
export function zdStockDayPresets(current: number | null): number[] {
  const base = [30, 45, 60, 90, 120];
  return current != null && current > 0 && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base;
}
