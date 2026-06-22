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

/** Zrealizowany dokument ZD w Subiekcie (dok_Status = 8, jak ZK). */
export function isFulfilledZdDocumentStatus(
  doc: Pick<SubiektDocument, "dok_Status">
): boolean {
  return doc.dok_Status === 8;
}

/**
 * Otwarty ZD do wyszukiwania terminu:
 * - pomija Zrealizowane (dok_Status 8),
 * - Aktywne (7) traktuje jako niezrealizowane,
 * - przy braku statusu — termin realizacji ≥ dziś.
 */
export function isActiveZdFulfillmentDocument(
  doc: Pick<
    SubiektDocument,
    | "dok_Status"
    | "dok_TerminRealizacji"
    | "dok_DataRealizacji"
    | "dok_Termin"
  >,
  at: Date = new Date()
): boolean {
  if (isFulfilledZdDocumentStatus(doc)) return false;
  if (doc.dok_Status === 7) return true;
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
