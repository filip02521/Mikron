/** Model widoku szuflady dostawcy (panel dzienny) — czyste funkcje bez Reacta. */

import { differenceInCalendarDays } from "date-fns";
import { parseDateOnly } from "@/lib/orders/dates";

export type SupplierDueTone = "overdue" | "today" | "soon" | "later" | "none";

export type SupplierDueInfo = {
  tone: SupplierDueTone;
  /** Krótko: „dziś”, „za 3 dni”, „zaległe 2 dni”. */
  relative: string | null;
};

function dni(n: number): string {
  return n === 1 ? "dzień" : "dni";
}

/** Ile zostało do planowanego zamówienia — do wyróżnienia terminu w nagłówku. */
export function supplierDueInfo(nextDate: string | null | undefined, todayKey: string): SupplierDueInfo {
  const next = parseDateOnly(nextDate ?? null);
  const today = parseDateOnly(todayKey);
  if (!next || !today) return { tone: "none", relative: null };
  const diff = differenceInCalendarDays(next, today);
  if (diff < 0) return { tone: "overdue", relative: `zaległe ${-diff} ${dni(-diff)}` };
  if (diff === 0) return { tone: "today", relative: "dziś" };
  if (diff === 1) return { tone: "soon", relative: "jutro" };
  if (diff <= 3) return { tone: "soon", relative: `za ${diff} dni` };
  return { tone: "later", relative: `za ${diff} dni` };
}

/** „250 PLN” — minimum zamówienia; null gdy brak. */
export function formatSupplierMinOrder(
  value: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const amount = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
  const cur = currency?.trim();
  return cur ? `${amount} ${cur}` : amount;
}
