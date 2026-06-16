import type { IndividualOrder } from "@/types/database";
import { MAX_PROCUREMENT_CANCEL_NOTE_LEN } from "@/lib/security/text-limits";

export const PROCUREMENT_CANCEL_NOTE_MIGRATION_HINT =
  "Brak kolumny procurement_cancel_note — uruchom supabase/migrations/063_procurement_cancel_note.sql";

export function isProcurementCancelNoteColumnMissing(message: string | undefined): boolean {
  return Boolean(message?.includes("procurement_cancel_note"));
}

export function throwIfProcurementCancelNoteColumnMissing(error: {
  message?: string;
}): void {
  if (isProcurementCancelNoteColumnMissing(error.message)) {
    throw new Error(PROCUREMENT_CANCEL_NOTE_MIGRATION_HINT);
  }
}

/** Normalizuje wiadomość od zakupów przy anulowaniu (pusty → null, obcięcie do limitu). */
export function normalizeProcurementCancelNote(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= MAX_PROCUREMENT_CANCEL_NOTE_LEN
    ? trimmed
    : trimmed.slice(0, MAX_PROCUREMENT_CANCEL_NOTE_LEN);
}

/** Anulowanie przez dział dostaw (nie rezygnacja handlowca). */
export function isProcurementInitiatedCancel(
  order: Pick<IndividualOrder, "status" | "sales_cancelled_at">
): boolean {
  return order.status === "Anulowane" && !order.sales_cancelled_at;
}

/** Patch DB przy anulowaniu przez dział dostaw (panel, historia, weryfikacja). */
export function buildProcurementCancelUpdate(
  procurementCancelNote?: string | null
): {
  status: "Anulowane";
  informacja_queue_via_daily_panel: false;
  informacja_stock_out_reorder: false;
  procurement_cancel_note?: string;
} {
  const normalizedNote = normalizeProcurementCancelNote(procurementCancelNote);
  return {
    status: "Anulowane",
    informacja_queue_via_daily_panel: false,
    informacja_stock_out_reorder: false,
    ...(normalizedNote != null ? { procurement_cancel_note: normalizedNote } : {}),
  };
}

/** Dział dostaw może edytować wiadomość, dopóki handlowiec nie potwierdzi anulowania. */
export function canEditProcurementCancelNote(
  order: Pick<IndividualOrder, "status" | "sales_cancelled_at" | "sales_acknowledged_at">
): boolean {
  return isProcurementInitiatedCancel(order) && !order.sales_acknowledged_at;
}

/** Prośbę można anulować z historii (zakupy / admin). */
export function canOperationsCancelIndividualOrder(
  order: Pick<IndividualOrder, "status" | "sales_cancelled_at">
): boolean {
  if (order.sales_cancelled_at) return false;
  return order.status === "Nowe" || order.status === "Weryfikacja";
}

export function procurementCancelNotesSummary(
  orders: Pick<IndividualOrder, "procurement_cancel_note">[]
): string | null {
  const notes = [
    ...new Set(
      orders
        .map((o) => normalizeProcurementCancelNote(o.procurement_cancel_note))
        .filter((n): n is string => Boolean(n))
    ),
  ];
  if (!notes.length) return null;
  if (notes.length === 1) return notes[0]!;
  return `${notes.length} różnych wiadomości`;
}

export function procurementCancelNotesSummaryFromLines(
  lines: Pick<{ procurementCancelNote?: string | null }, "procurementCancelNote">[]
): string | null {
  return procurementCancelNotesSummary(
    lines.map((line) => ({
      procurement_cancel_note: line.procurementCancelNote ?? null,
    }))
  );
}

/** Jedna wspólna wiadomość w grupie — do wyświetlenia w nagłówku. */
export function sharedProcurementCancelNoteFromLines(
  lines: Pick<{ procurementCancelNote?: string | null }, "procurementCancelNote">[]
): string | null {
  const notes = [
    ...new Set(
      lines
        .map((line) => normalizeProcurementCancelNote(line.procurementCancelNote))
        .filter((n): n is string => Boolean(n))
    ),
  ];
  if (notes.length !== 1) return null;
  return notes[0]!;
}

/** Skrót „N różnych wiadomości” zamiast treści — nie pokazuj jako jednej wspólnej notatki. */
export function isProcurementCancelNotesAggregateSummary(
  value: string | null | undefined
): boolean {
  return Boolean(value?.includes("różnych wiadomości"));
}

function uniqueProcurementCancelNotesFromLines(
  lines: Pick<{ procurementCancelNote?: string | null }, "procurementCancelNote">[]
): string[] {
  return [
    ...new Set(
      lines
        .map((line) => normalizeProcurementCancelNote(line.procurementCancelNote))
        .filter((n): n is string => Boolean(n))
    ),
  ];
}

/** Różne wiadomości od dostaw na pozycjach w jednej grupie. */
export function linesHaveMixedProcurementCancelNotes(
  lines: Pick<{ procurementCancelNote?: string | null }, "procurementCancelNote">[]
): boolean {
  return uniqueProcurementCancelNotesFromLines(lines).length > 1;
}

/** Sufiks przy grupie w Moje zamówienia — gdy wiadomości są per produkt. */
export function procurementCancelNotesMojeSublineSuffix(
  lines: Pick<{ procurementCancelNote?: string | null }, "procurementCancelNote">[]
): string {
  if (!linesHaveMixedProcurementCancelNotes(lines)) return "";
  return " · wiadomości przy produktach";
}

export function procurementInitiatedCancelStatusCopy(
  kind: "zamowienie" | "informacja"
): { statusTitle: string; statusDetail: string } {
  if (kind === "informacja") {
    return {
      statusTitle: "Anulowano",
      statusDetail:
        "Dział dostaw anulował prośbę. Potwierdź, aby ukryć ją z listy.",
    };
  }
  return {
    statusTitle: "Anulowane",
    statusDetail:
      "Dział dostaw anulował zgłoszenie. Potwierdź, aby ukryć je z listy.",
  };
}
