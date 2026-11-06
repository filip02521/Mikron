/**
 * Sprzęt zastępczy — czysta logika: stan egzemplarza, okresy u klientów, statystyki.
 * Daty jako ISO (z bazy) albo Date; „dziś” przekazywane z zewnątrz, żeby testy były deterministyczne.
 */

export type LoanerStatus = "na_stanie" | "u_klienta" | "przeglad" | "wycofany";
export type LoanerEventType =
  | "created"
  | "issued"
  | "returned"
  | "extended"
  | "service_start"
  | "service_end"
  | "retired";

/** Stan do wyświetlenia: u klienta rozbity na zwykły / ponad próg / po terminie. */
export type LoanerViewState = "free" | "out" | "warn" | "late" | "svc" | "retired";

export const LOANER_WARN_DAYS = 14;
export const LOANER_RETURN_PRESETS = [7, 14, 21, 30] as const;
export const LOANER_CONDITIONS = ["bardzo dobry", "dobry", "do przeglądu", "uszkodzony"] as const;

export type LoanerUnit = {
  id: string;
  code: string;
  serialNo: string | null;
  subiektTwId: number;
  twSymbol: string | null;
  twName: string;
  condition: string;
  status: LoanerStatus;
  currentKhId: number | null;
  currentClientName: string | null;
  currentClientPhone: string | null;
  currentSince: string | null;
  plannedReturn: string | null;
  note: string;
  createdAt: string;
};

export type LoanerEvent = {
  id: number;
  unitId: string;
  at: string;
  type: LoanerEventType;
  khId: number | null;
  clientName: string | null;
  plannedReturn: string | null;
  condition: string | null;
  note: string;
  actorName: string | null;
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Pełne dni kalendarzowe między datami (lokalnie), bez ułamków. */
export function daysBetween(from: Date | string, to: Date | string): number {
  return Math.round((startOfDay(new Date(to)) - startOfDay(new Date(from))) / DAY_MS);
}

/** `YYYY-MM-DD` z daty planowanego zwrotu — porównujemy dni, nie godziny. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function toDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function loanerViewState(unit: Pick<LoanerUnit, "status" | "currentSince" | "plannedReturn">, today: Date): LoanerViewState {
  if (unit.status === "wycofany") return "retired";
  if (unit.status === "przeglad") return "svc";
  if (unit.status === "na_stanie" || !unit.currentSince) return "free";
  if (unit.plannedReturn && daysBetween(parseDateOnly(unit.plannedReturn), today) > 0) return "late";
  if (daysBetween(unit.currentSince, today) > LOANER_WARN_DAYS) return "warn";
  return "out";
}

export const LOANER_STATE_LABEL: Record<LoanerViewState, string> = {
  free: "na stanie",
  out: "u klienta",
  warn: `u klienta ponad ${LOANER_WARN_DAYS} dni`,
  late: "po terminie zwrotu",
  svc: "w przeglądzie",
  retired: "wycofany",
};

/** Kolejność „najpilniejsze najpierw” na liście. */
export const LOANER_STATE_RANK: Record<LoanerViewState, number> = {
  late: 0,
  warn: 1,
  out: 2,
  svc: 3,
  free: 4,
  retired: 5,
};

export type LoanerStint = {
  clientName: string;
  from: string;
  /** null = nadal u klienta. */
  to: string | null;
  plannedReturn: string | null;
};

export type LoanerServiceSpan = { from: string; to: string | null };

/** Okresy u klientów i w przeglądzie odtworzone z historii (zdarzenia w dowolnej kolejności). */
export function loanerSpans(events: readonly LoanerEvent[]): { stints: LoanerStint[]; service: LoanerServiceSpan[] } {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const stints: LoanerStint[] = [];
  const service: LoanerServiceSpan[] = [];
  let open: LoanerStint | null = null;
  let svc: LoanerServiceSpan | null = null;
  for (const e of sorted) {
    if (e.type === "issued") {
      if (open) open.to = e.at;
      open = { clientName: e.clientName ?? "-", from: e.at, to: null, plannedReturn: e.plannedReturn };
      stints.push(open);
    } else if (e.type === "extended" && open) {
      open.plannedReturn = e.plannedReturn;
    } else if (e.type === "returned" && open) {
      open.to = e.at;
      open = null;
    } else if (e.type === "service_start") {
      svc = { from: e.at, to: null };
      service.push(svc);
    } else if (e.type === "service_end" && svc) {
      svc.to = e.at;
      svc = null;
    }
  }
  return { stints, service };
}

export type LoanerStats = {
  issues: number;
  avgDaysOut: number;
  /** Udział dni u klientów od dodania egzemplarza, 0–100. */
  utilizationPct: number;
};

export function loanerStats(unit: Pick<LoanerUnit, "createdAt">, stints: readonly LoanerStint[], today: Date): LoanerStats {
  const total = stints.reduce((n, s) => n + Math.max(0, daysBetween(s.from, s.to ?? today)), 0);
  const age = Math.max(1, daysBetween(unit.createdAt, today));
  return {
    issues: stints.length,
    avgDaysOut: stints.length ? Math.round(total / stints.length) : 0,
    utilizationPct: Math.min(100, Math.round((total / age) * 100)),
  };
}

/** Grupy po towarze z Subiekta (model). */
export function groupLoanersByModel<T extends Pick<LoanerUnit, "subiektTwId" | "twName">>(
  units: readonly T[]
): { twId: number; name: string; units: T[] }[] {
  const map = new Map<number, { twId: number; name: string; units: T[] }>();
  for (const u of units) {
    const g = map.get(u.subiektTwId) ?? { twId: u.subiektTwId, name: u.twName, units: [] };
    g.units.push(u);
    map.set(u.subiektTwId, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function normalizeLoanerCode(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Następny wolny numer ZAST-NNN. */
export function nextLoanerCode(existing: readonly string[]): string {
  let max = 0;
  for (const c of existing) {
    const m = /^ZAST-(\d+)$/i.exec(c.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ZAST-${String(max + 1).padStart(3, "0")}`;
}
