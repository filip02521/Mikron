/** Widok zgłoszeń ROL: liczby w wierszu klienta, blokady wysyłki, etykiety stanów i miesięcy. */
import { polishPlural } from "@/lib/email/polish-plural";
import type { RolInvoiceView, RolLineView } from "./data";
import type { RolBatchStatus } from "./merge";
import { ROL_CONFLICT_REASON } from "./constants";

type RolBatchContent = { invoices: readonly RolInvoiceView[]; lines: readonly RolLineView[] };

export const ROL_STATUS_BADGE: Record<
  RolBatchStatus,
  { label: string; variant: "default" | "success" | "warning" | "info" | "danger" }
> = {
  wykryte: { label: "Do przeglądu", variant: "warning" },
  przejrzane: { label: "Przejrzane", variant: "info" },
  wyslane: { label: "Wysłane", variant: "success" },
  brak_zakupow: { label: "Brak zakupów", variant: "default" },
  potwierdzone: { label: "Potwierdzone", variant: "success" },
  do_korekty: { label: "Do korekty", variant: "danger" },
};

/** Paczka wymaga ruchu: przegląd albo wysyłka. Jedna definicja dla zakładki i licznika w menu. */
export const ROL_NEEDS_ACTION_STATUSES: readonly RolBatchStatus[] = ["wykryte", "przejrzane"];

export function rolNeedsAction(status: RolBatchStatus): boolean {
  return ROL_NEEDS_ACTION_STATUSES.includes(status);
}

const MONTHS_PL = [
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

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Dopełniacz do zakresów dni („3–9 listopada”). */
const MONTHS_PL_GEN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

const monthIdx = (key: string) => Number(key.slice(5, 7)) - 1;
const dayOf = (key: string) => Number(key.slice(8, 10));

/** Cały miesiąc (bez końca okresu albo od 1. do ostatniego dnia) — inaczej tydzień / dwa tygodnie. */
function isWholeMonth(period: string, periodEnd?: string): boolean {
  if (!periodEnd) return true;
  const [y, m] = period.split("-").map(Number) as [number, number];
  return dayOf(period) === 1 && periodEnd.slice(0, 7) === period.slice(0, 7) && dayOf(periodEnd) === new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** „September” z `2026-09-01`; krótki okres: „3-9 November” albo „27 October-2 November” (mail, pliki). */
export function rolMonthEn(period: string, periodEnd?: string): string {
  if (isWholeMonth(period, periodEnd)) return ENGLISH_MONTHS[monthIdx(period)] ?? "";
  const end = `${dayOf(periodEnd!)} ${ENGLISH_MONTHS[monthIdx(periodEnd!)]}`;
  return monthIdx(period) === monthIdx(periodEnd!) ? `${dayOf(period)}-${end}` : `${dayOf(period)} ${ENGLISH_MONTHS[monthIdx(period)]}-${end}`;
}

/** „wrzesień” z `2026-09-01` (opis ZD, bez roku); krótki okres: „3–9 listopada”. */
export function rolMonthPl(period: string, periodEnd?: string): string {
  if (isWholeMonth(period, periodEnd)) return MONTHS_PL[monthIdx(period)] ?? "";
  const end = `${dayOf(periodEnd!)} ${MONTHS_PL_GEN[monthIdx(periodEnd!)]}`;
  return monthIdx(period) === monthIdx(periodEnd!) ? `${dayOf(period)}–${end}` : `${dayOf(period)} ${MONTHS_PL_GEN[monthIdx(period)]} – ${end}`;
}

/** Rok okresu do nazw plików — rok ostatniego dnia (tydzień na przełomie roku należy do nowego). */
export function rolPeriodYear(period: string, periodEnd?: string): string {
  return (periodEnd ?? period).slice(0, 4);
}

/** „wrzesień 2026” z `2026-09-01`; krótki okres: „3–9 listopada 2026”. */
export function rolPeriodLabel(period: string, periodEnd?: string): string {
  return `${rolMonthPl(period, periodEnd)} ${rolPeriodYear(period, periodEnd)}`;
}

/** Ostatnie `count` miesięcy przed `todayKey`, od najnowszego (`YYYY-MM-01`). */
export function recentRolPeriods(todayKey: string, count = 6): string[] {
  let [y, m] = todayKey.split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
  }
  return out;
}

/** Ilość, która pójdzie do arkusza: ręczna albo FS minus KFS. */
export function rolLineQty(line: Pick<RolLineView, "qtyFs" | "qtyKfs" | "qtyOverride">): number {
  return line.qtyOverride ?? Math.max(0, line.qtyFs - line.qtyKfs);
}

/** Pozycje, które pójdą do zgłoszenia (bez wyłączonych FS i pozycji, bez zera). */
export function rolActiveLines(batch: RolBatchContent): RolLineView[] {
  const excludedFs = new Set(batch.invoices.filter((i) => i.excluded).map((i) => i.fsDokId));
  return batch.lines.filter((l) => !l.excluded && !excludedFs.has(l.fsDokId) && rolLineQty(l) > 0);
}

export function rolBatchSummary(batch: RolBatchContent): {
  fsCount: number;
  positions: number;
  pieces: number;
  text: string;
} {
  const active = rolActiveLines(batch);
  const fsCount = new Set(active.map((l) => l.fsDokId)).size;
  const positions = new Set(active.map((l) => l.twId)).size;
  const pieces = active.reduce((s, l) => s + rolLineQty(l), 0);
  return {
    fsCount,
    positions,
    pieces,
    text: positions ? `${polishPlural(positions, "pozycja", "pozycje", "pozycji")} · ${pieces} szt.` : "bez pozycji",
  };
}

/** Powody, dla których paczki nie da się jeszcze zatwierdzić do wysyłki (tekstem obok przycisku). */
export function rolBatchBlockers(batch: RolBatchContent): string[] {
  const out: string[] = [];
  const conflicts = batch.invoices.filter((i) => i.excluded && i.excludedReason === ROL_CONFLICT_REASON).length;
  if (conflicts) out.push(`${polishPlural(conflicts, "FS pasuje", "FS pasują", "FS pasuje")} do dwóch klientów ROL`);
  const noCatalog = rolActiveLines(batch).filter((l) => !l.ivoclarCatalogNo).length;
  if (noCatalog) out.push(`${polishPlural(noCatalog, "pozycja", "pozycje", "pozycji")} bez nr kat. Ivoclar`);
  return out;
}
