/** Widok zgłoszeń ROL: liczby w wierszu klienta, blokady wysyłki, etykiety stanów i miesięcy. */
import { polishPlural } from "@/lib/email/polish-plural";
import type { RolBatchView, RolLineView } from "./data";
import type { RolBatchStatus } from "./merge";
import { ROL_CONFLICT_REASON } from "./constants";

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

/** „wrzesień 2026” z `2026-09-01`. */
export function rolPeriodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return `${MONTHS_PL[m - 1]} ${y}`;
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
export function rolActiveLines(batch: Pick<RolBatchView, "invoices" | "lines">): RolLineView[] {
  const excludedFs = new Set(batch.invoices.filter((i) => i.excluded).map((i) => i.fsDokId));
  return batch.lines.filter((l) => !l.excluded && !excludedFs.has(l.fsDokId) && rolLineQty(l) > 0);
}

export function rolBatchSummary(batch: Pick<RolBatchView, "invoices" | "lines">): {
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
export function rolBatchBlockers(batch: Pick<RolBatchView, "invoices" | "lines">): string[] {
  const out: string[] = [];
  const conflicts = batch.invoices.filter((i) => i.excluded && i.excludedReason === ROL_CONFLICT_REASON).length;
  if (conflicts) out.push(`${polishPlural(conflicts, "FS pasuje", "FS pasują", "FS pasuje")} do dwóch klientów ROL`);
  const noCatalog = rolActiveLines(batch).filter((l) => !l.ivoclarCatalogNo).length;
  if (noCatalog) out.push(`${polishPlural(noCatalog, "pozycja", "pozycje", "pozycji")} bez nr kat. Ivoclar`);
  return out;
}
