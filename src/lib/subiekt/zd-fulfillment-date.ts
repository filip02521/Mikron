import { parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { parseSubiektDocDate } from "@/lib/subiekt/zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** Czy termin realizacji ZD jest dziś lub w przyszłości (przeszłe = już zrealizowane). */
export function isActiveZdFulfillmentDeadline(
  deadline: string | null | undefined,
  at: Date = new Date()
): boolean {
  if (!deadline?.trim()) return false;
  const parsed = parseDateOnly(deadline.trim());
  if (!parsed) return false;
  const today = toDateOnly(at);
  return parsed.getTime() >= today.getTime();
}

/** Aktywny ZD — ma termin realizacji ≥ dziś. */
export function isActiveZdFulfillmentDocument(
  doc: Pick<
    SubiektDocument,
    "dok_TerminRealizacji" | "dok_DataRealizacji" | "dok_Termin"
  >,
  at: Date = new Date()
): boolean {
  return isActiveZdFulfillmentDeadline(parseZdFulfillmentDeadline(doc), at);
}

/** Termin realizacji z nagłówka dokumentu ZD (pierwsze dostępne pole). */
export function parseZdFulfillmentDeadline(
  doc: Pick<
    SubiektDocument,
    "dok_TerminRealizacji" | "dok_DataRealizacji" | "dok_Termin"
  >
): string | null {
  const raw =
    doc.dok_TerminRealizacji ?? doc.dok_DataRealizacji ?? doc.dok_Termin ?? null;
  const sliced = parseSubiektDocDate(raw);
  if (!sliced) return null;
  return parseDateOnly(sliced) ? sliced : null;
}
