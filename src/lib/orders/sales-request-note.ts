import type { IndividualOrder } from "@/types/database";
import { MAX_SALES_REQUEST_NOTE_LEN } from "@/lib/security/text-limits";

/** Normalizuje notatkę do prośby (pusty → null, obcięcie do limitu). */
export function normalizeSalesRequestNote(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= MAX_SALES_REQUEST_NOTE_LEN
    ? trimmed
    : trimmed.slice(0, MAX_SALES_REQUEST_NOTE_LEN);
}

export function requestNotesSummary(
  orders: Pick<IndividualOrder, "sales_request_note">[]
): string | null {
  const notes = [
    ...new Set(
      orders
        .map((o) => normalizeSalesRequestNote(o.sales_request_note))
        .filter((n): n is string => Boolean(n))
    ),
  ];
  if (!notes.length) return null;
  if (notes.length === 1) return notes[0]!;
  return `${notes.length} różnych notatek`;
}

export function requestNotesSummaryFromLines(
  lines: Pick<{ requestNote?: string | null }, "requestNote">[]
): string | null {
  return requestNotesSummary(
    lines.map((line) => ({ sales_request_note: line.requestNote ?? null }))
  );
}

/** Jedna wspólna notatka w grupie — do wyświetlenia w nagłówku. */
export function sharedRequestNoteFromLines(
  lines: Pick<{ requestNote?: string | null }, "requestNote">[]
): string | null {
  const notes = [
    ...new Set(
      lines
        .map((line) => normalizeSalesRequestNote(line.requestNote))
        .filter((n): n is string => Boolean(n))
    ),
  ];
  if (notes.length !== 1) return null;
  return notes[0]!;
}

/** Skrót „N różnych notatek” zamiast treści — nie pokazuj jako jednej wspólnej notatki. */
export function isRequestNotesAggregateSummary(value: string | null | undefined): boolean {
  return Boolean(value?.includes("różnych notatek"));
}

function uniqueRequestNotesFromLines(
  lines: Pick<{ requestNote?: string | null }, "requestNote">[]
): string[] {
  return [
    ...new Set(
      lines
        .map((line) => normalizeSalesRequestNote(line.requestNote))
        .filter((n): n is string => Boolean(n))
    ),
  ];
}

/** Różne uwagi na pozycjach w jednej grupie. */
export function linesHaveMixedRequestNotes(
  lines: Pick<{ requestNote?: string | null }, "requestNote">[]
): boolean {
  return uniqueRequestNotesFromLines(lines).length > 1;
}

/** Sufiks subline w panelu dziennym — gdy uwagi są per produkt. */
export function requestNotesProcurementSublineSuffix(
  lines: Pick<{ requestNote?: string | null }, "requestNote">[]
): string {
  if (!linesHaveMixedRequestNotes(lines)) return "";
  return " · uwagi przy produktach";
}
