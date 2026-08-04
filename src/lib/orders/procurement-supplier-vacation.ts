/**
 * Urlop dostawcy „teraz” — okno kalendarzowe [start, end], bez luki lastOrder→start
 * i bez przyszłych aktywnych urlopów (w przeciwieństwie do isVacationEffectivelyActive).
 */

import { formatDateString, parseDateOnly } from "@/lib/orders/dates";

export type SupplierOnVacationWindow = {
  startDate: string;
  endDate: string;
};

export type VacationCalendarRow = {
  supplier_id: string;
  active: boolean;
  start_date: string;
  end_date: string;
};

/** Dziś w aktywnym oknie urlopu (porównanie YYYY-MM-DD). */
export function isSupplierOnVacationNow(
  row: Pick<VacationCalendarRow, "active" | "start_date" | "end_date">,
  todayKey: string
): boolean {
  if (!row.active) return false;
  if (!todayKey || !row.start_date || !row.end_date) return false;
  return row.start_date <= todayKey && row.end_date >= todayKey;
}

/**
 * Mapa supplierId → aktywne okno urlopu obejmujące dziś.
 * Przy wielu wierszach dla tego samego dostawcy — pierwsze pasujące.
 */
export function buildSuppliersOnVacationNow(
  rows: VacationCalendarRow[],
  todayKey: string
): Record<string, SupplierOnVacationWindow> {
  const out: Record<string, SupplierOnVacationWindow> = {};
  for (const row of rows) {
    if (!row.supplier_id || !isSupplierOnVacationNow(row, todayKey)) continue;
    if (out[row.supplier_id]) continue;
    out[row.supplier_id] = {
      startDate: row.start_date,
      endDate: row.end_date,
    };
  }
  return out;
}

export function groupMatchesSupplierVacationFilter(
  supplierId: string,
  onVacation: Record<string, SupplierOnVacationWindow>
): boolean {
  return Boolean(supplierId && onVacation[supplierId]);
}

/** Zakres do chipa: `1.08–15.08`. */
export function formatSupplierVacationRangeCompact(
  window: SupplierOnVacationWindow
): string {
  const start = parseDateOnly(window.startDate);
  const end = parseDateOnly(window.endDate);
  if (!start || !end) return `${window.startDate}–${window.endDate}`;
  return `${formatDateString(start, "d.MM")}–${formatDateString(end, "d.MM")}`;
}

/** Tooltip: pełny zakres. */
export function formatSupplierVacationRangeTitle(
  window: SupplierOnVacationWindow
): string {
  const start = parseDateOnly(window.startDate);
  const end = parseDateOnly(window.endDate);
  if (!start || !end) return `${window.startDate}–${window.endDate}`;
  return `${formatDateString(start, "dd.MM.yyyy")}–${formatDateString(end, "dd.MM.yyyy")}`;
}
