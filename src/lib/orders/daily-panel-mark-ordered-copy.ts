import { undoWindowLongLabel } from "@/lib/orders/daily-panel-undo";

/** Etykieta przycisku / skrótu — mówi skutek (sam „Zamówione” czytało się jak stan, nie akcja). */
export const DAILY_PANEL_MARK_ORDERED_LABEL = "Oznacz jako zamówione";

export const DAILY_PANEL_MARK_ORDERED_PENDING = "Zapisywanie…";

export const DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY =
  "Oznaczanie jako zamówione…";

export function dailyPanelMarkOrderedConfirmTitle(): string {
  return "Oznaczyć jako zamówione?";
}

/** Treść dialogu potwierdzenia — pojedynczy dostawca (szuflada / skrót Z). */
export function dailyPanelMarkOrderedConfirmMessage(supplierName: string): string {
  const name = supplierName.trim() || "tego dostawcy";
  return [
    `Potwierdzasz, że zamówienie u „${name}” zostało złożone u dostawcy.`,
    "",
    `Zapiszesz dzisiejszą datę zamówienia i przeliczysz harmonogram. Po potwierdzeniu masz ${undoWindowLongLabel()} na cofnięcie.`,
  ].join("\n");
}

export function dailyPanelMarkOrderedConfirmLabel(): string {
  return "Tak, zamówione";
}

/** Tytuł UndoToast / NoticeToast po udanym oznaczeniu. */
export function dailyPanelMarkOrderedToastTitle(supplierName?: string | null): string {
  const name = supplierName?.trim();
  if (!name) return "Oznaczono jako zamówione";
  return `Zamówienie u „${name}” zapisane`;
}
