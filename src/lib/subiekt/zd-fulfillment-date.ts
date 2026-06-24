import { parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { parseSubiektDocDate } from "@/lib/subiekt/zk-document";
import type { SubiektListParams } from "@/lib/subiekt/api";
import type { SubiektDocument } from "@/lib/subiekt/types";

/**
 * Subiekt ZD (typ 15) — otwarte zamówienia do dostawcy.
 * 5/6/7 = niezrealizowane (w tym częściowo zrealizowane, dopóki status ≠ 8).
 * Etykiety ZK (6=Oferta, 7=Aktywne) nie dotyczą ZD — patrz forum Subiekt / dok_Status.
 */
export const ZD_DOCUMENT_STATUS_UNREALIZED = 5;
export const ZD_DOCUMENT_STATUS_UNREALIZED_NO_RESERVATION = 6;
export const ZD_DOCUMENT_STATUS_UNREALIZED_WITH_RESERVATION = 7;
export const ZD_DOCUMENT_STATUS_FULFILLED = 8;

export const ZD_ETA_OPEN_DOCUMENT_STATUSES: readonly number[] = [
  ZD_DOCUMENT_STATUS_UNREALIZED,
  ZD_DOCUMENT_STATUS_UNREALIZED_NO_RESERVATION,
  ZD_DOCUMENT_STATUS_UNREALIZED_WITH_RESERVATION,
];

export function isZdEtaOpenDocumentStatus(status: number | null | undefined): boolean {
  if (status == null) return false;
  return ZD_ETA_OPEN_DOCUMENT_STATUSES.includes(status);
}

/** Alias — czytelniejsza nazwa w kontekście ETA. */
export function isUnrealizedZdDocumentStatus(
  doc: Pick<SubiektDocument, "dok_Status">
): boolean {
  return isZdEtaOpenDocumentStatus(doc.dok_Status);
}

/** Marker ścieżki ETA — bez filtra statusu w API (potrzebujemy 5+6+7, nie jednej wartości). */
export function withZdEtaSubiektListParams<T extends SubiektListParams>(params: T): T {
  return params;
}

/** Pomija zrealizowane i inne zamknięte wpisy z listy API bez ładowania pełnego dokumentu. */
export function shouldSkipZdListItemForEta(
  item: Pick<SubiektDocument, "dok_Status">
): boolean {
  if (item.dok_Status == null) return false;
  if (item.dok_Status === ZD_DOCUMENT_STATUS_FULFILLED) return true;
  return !isZdEtaOpenDocumentStatus(item.dok_Status);
}

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

/** Zrealizowany dokument ZD w Subiekcie (dok_Status = 8). */
export function isFulfilledZdDocumentStatus(
  doc: Pick<SubiektDocument, "dok_Status">
): boolean {
  return doc.dok_Status === ZD_DOCUMENT_STATUS_FULFILLED;
}

/**
 * ZD kwalifikujące się do ETA w /moje:
 * - niezrealizowane i częściowo zrealizowane: dok_Status 5, 6 lub 7,
 * - wykluczone: zrealizowane (8) oraz pozostałe statusy zamknięte,
 * - bez statusu w odpowiedzi API: akceptuj tylko z terminem ≥ dziś.
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
  if (isZdEtaOpenDocumentStatus(doc.dok_Status)) return true;
  if (doc.dok_Status == null) {
    return isActiveZdFulfillmentDeadline(parseZdFulfillmentDeadline(doc), at);
  }
  return false;
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
