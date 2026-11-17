/**
 * Zakres dat historii towaru (karta produktu w Kreatorze ZD, „Ustawienia towaru”): gotowe okresy albo własny
 * przedział od–do, wspólny dla zakupów, sprzedaży i ruchu towaru. Tylko filtr widoku — nic nie zapisuje.
 * Czyste funkcje na kluczach dat YYYY-MM-DD.
 */
import { ZD_MOVEMENT_MIN_DAYS } from "@/lib/orders/zd-product-movement";

export type ZdHistoryPreset = "window" | "1m" | "3m" | "6m" | "12m" | "all" | "custom";

export type ZdHistoryRangeState = { preset: ZdHistoryPreset; customFrom?: string; customTo?: string };

/** Zakres po rozwiązaniu: `from` null = bez dolnej granicy (cała historia), `to` włącznie. */
export type ZdHistoryRange = { from: string | null; to: string };

const DAY_MS = 86_400_000;
const PRESET_DAYS: Partial<Record<ZdHistoryPreset, number>> = { "1m": 30, "3m": 91, "6m": 182, "12m": 365 };
/** Sprzedaż z Subiekta karta pobiera tylko z ostatnich 12 miesięcy. */
export const ZD_SALES_HISTORY_DAYS = 365;

const dayNum = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / DAY_MS;
const keyOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const shiftDateKey = (key: string, days: number) => keyOf(dayNum(key) + days);
const isKey = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function resolveZdHistoryRange(
  state: ZdHistoryRangeState,
  salesWindow: { dataOd: string; dataDo: string } | null | undefined,
  todayKey: string
): ZdHistoryRange {
  const today = todayKey.slice(0, 10);
  if (state.preset === "all") return { from: null, to: today };
  if (state.preset === "custom") {
    const to = isKey(state.customTo) ? state.customTo : today;
    const from = isKey(state.customFrom) ? state.customFrom : shiftDateKey(to, -(ZD_MOVEMENT_MIN_DAYS - 1));
    // Odwrócone daty: zamieniamy, zamiast pokazywać pusty zakres.
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const days = PRESET_DAYS[state.preset];
  if (days != null) return { from: shiftDateKey(today, -(days - 1)), to: today };
  // „Okno zapasu”: okno sprzedaży, z którego Kreator liczy zapas, nie krócej niż miesiąc.
  const to = salesWindow?.dataDo?.slice(0, 10) || today;
  const minFrom = shiftDateKey(to, -(ZD_MOVEMENT_MIN_DAYS - 1));
  const from = salesWindow?.dataOd?.slice(0, 10);
  return { from: from && from < minFrom ? from : minFrom, to };
}

/**
 * Zmiana jednej granicy własnego przedziału. Zapisuje stan już uporządkowany (od ≤ do), żeby pola dat pokazywały
 * to, co jest w stanie: inaczej po odwróconych datach kolejna zmiana „Od” gubi wcześniejsze „Do”.
 */
export function setZdCustomRangeBound(range: ZdHistoryRange, bound: "from" | "to", value: string): ZdHistoryRangeState {
  const v = isKey(value) ? value : undefined;
  let from = bound === "from" ? v : (range.from ?? undefined);
  let to = bound === "to" ? v : range.to;
  if (from && to && from > to) [from, to] = [to, from];
  return { preset: "custom", customFrom: from, customTo: to };
}

export function isInZdHistoryRange(date: string | null | undefined, range: ZdHistoryRange): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return (range.from == null || d >= range.from) && d <= range.to;
}

/** Zakres sięga dalej niż 12 miesięcy sprzedaży z Subiekta (podpis „sprzedaż tylko z 12 mies.”). */
export function zdRangeExceedsSalesHistory(range: ZdHistoryRange, todayKey: string): boolean {
  return range.from == null || range.from < shiftDateKey(todayKey.slice(0, 10), -(ZD_SALES_HISTORY_DAYS - 1));
}

/** „01.08–31.10.2026”, „od początku do 09.11.2026”. */
export function formatZdHistoryRange(range: ZdHistoryRange): string {
  const pl = (k: string) => `${k.slice(8, 10)}.${k.slice(5, 7)}.${k.slice(0, 4)}`;
  if (range.from == null) return `cała historia do ${pl(range.to)}`;
  const from = range.from.slice(0, 4) === range.to.slice(0, 4) ? pl(range.from).slice(0, 5) : pl(range.from);
  return `${from}–${pl(range.to)}`;
}

export type ZdFlowItem = { date: string; kind: "in" | "out" | "zd"; pieces: number };

export type ZdFlowBucket = {
  /** Pierwszy dzień kubełka (poniedziałek tygodnia albo 1. dzień miesiąca). */
  start: string;
  label: string;
  inPieces: number;
  /** Sprzedaż netto (zwroty pomniejszają), nigdy poniżej zera. */
  outPieces: number;
  zdPieces: number;
};

const FLOW_MAX_BUCKETS = 130;
const MONTHS_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** Początek kubełka osi dla daty: poniedziałek tygodnia albo 1. dzień miesiąca. */
export function zdFlowBucketStart(key: string, unit: "week" | "month"): string {
  if (unit === "month") return `${key.slice(0, 7)}-01`;
  const n = dayNum(key);
  const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7; // pon = 0
  return keyOf(n - weekday);
}

/**
 * Przyjęcia, sprzedaż i zamówienia w kubełkach osi: tygodnie do ~4 miesięcy zakresu, dłużej miesiące.
 * Puste kubełki zostają (oś czasu bez dziur). Zakres bez dolnej granicy zaczyna się od najstarszego zdarzenia.
 */
export function bucketZdFlow(
  items: readonly ZdFlowItem[],
  range: ZdHistoryRange
): { unit: "week" | "month"; buckets: ZdFlowBucket[] } {
  const inRange = items.filter((i) => isInZdHistoryRange(i.date, range));
  const from = range.from ?? inRange.reduce<string | null>((m, i) => (m == null || i.date < m ? i.date.slice(0, 10) : m), null) ?? range.to;
  const unit: "week" | "month" = dayNum(range.to) - dayNum(from) <= 120 ? "week" : "month";
  const buckets: ZdFlowBucket[] = [];
  const index = new Map<string, ZdFlowBucket>();
  const last = zdFlowBucketStart(range.to, unit);
  let cursor = zdFlowBucketStart(from, unit);
  // Bezpiecznik: najwyżej 130 miesięcy, liczone wstecz od końca zakresu — dłuższa historia gubi najstarsze, nie najnowsze.
  if (unit === "month") {
    const earliest = keyOf(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1 - (FLOW_MAX_BUCKETS - 1), 1) / DAY_MS);
    if (cursor < earliest) cursor = earliest;
  }
  for (let guard = 0; cursor <= last && guard < FLOW_MAX_BUCKETS; guard += 1) {
    const d = new Date(`${cursor}T00:00:00Z`);
    // Rok przy styczniu i na początku osi: „lis 25 … lis” nie myli dwóch listopadów.
    const label =
      unit === "month"
        ? `${MONTHS_PL[d.getUTCMonth()]}${d.getUTCMonth() === 0 || buckets.length === 0 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ""}`
        : `${cursor.slice(8, 10)}.${cursor.slice(5, 7)}`;
    const b: ZdFlowBucket = { start: cursor, label, inPieces: 0, outPieces: 0, zdPieces: 0 };
    buckets.push(b);
    index.set(cursor, b);
    cursor = unit === "month" ? keyOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS) : shiftDateKey(cursor, 7);
  }
  for (const i of inRange) {
    const b = index.get(zdFlowBucketStart(i.date, unit));
    if (!b) continue;
    if (i.kind === "in") b.inPieces += i.pieces;
    else if (i.kind === "zd") b.zdPieces += i.pieces;
    else b.outPieces += i.pieces;
  }
  for (const b of buckets) b.outPieces = Math.max(0, b.outPieces);
  return { unit, buckets };
}

/** Nagłówek miesiąca w dzienniku: „listopad 2026”. */
const MONTH_NAMES_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];
export function formatZdMonthHeading(dateKey: string): string {
  return `${MONTH_NAMES_PL[Number(dateKey.slice(5, 7)) - 1] ?? ""} ${dateKey.slice(0, 4)}`;
}
