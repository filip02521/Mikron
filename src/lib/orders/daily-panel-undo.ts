/** Token cofania zmian w panelu dziennym (serializowany między akcją a cofnięciem). */

export type ScheduleSnapshot = {
  supplierId: string;
  orderDate: string | null;
  shiftDate: string | null;
};

export type IndividualOrderSnapshot = {
  orderId: string;
  status: string;
  orderType: string | null;
  orderedAt: string | null;
  placementGroupId: string | null;
  procurementSeenAt: string | null;
  informacjaQueueViaDailyPanel: boolean | null;
};

export type DailyPanelUndoToken =
  | { kind: "schedules"; snapshots: ScheduleSnapshot[] }
  | { kind: "individual"; snapshots: IndividualOrderSnapshot[] }
  | {
      kind: "combined";
      schedules: ScheduleSnapshot[];
      individuals: IndividualOrderSnapshot[];
    };

export type DailyPanelUndoPayload = {
  token: DailyPanelUndoToken;
  performedAt: number;
};

/** Wspólne okno cofania — toast UI i walidacja po stronie serwera. */
export const UNDO_WINDOW_MS = 10_000;

export const DAILY_PANEL_UNDO_MS = UNDO_WINDOW_MS;

/** Krótki opis w toastach: „10 s”. */
export function undoWindowShortLabel(): string {
  return `${UNDO_WINDOW_MS / 1000} s`;
}

/** Dłuższy opis w dialogach: „10 sekund”. */
export function undoWindowLongLabel(): string {
  return "10 sekund";
}

export function undoWindowBannerDescription(hint?: string): string {
  const windowLabel = undoWindowLongLabel();
  if (hint?.trim()) {
    return `${hint.trim()} — masz ${windowLabel} na cofnięcie.`;
  }
  return `Masz ${windowLabel} na cofnięcie.`;
}

export type DailyPanelActionResult = {
  success: true;
  undo?: DailyPanelUndoPayload;
  /** Krótkie linie do toastu (np. kolejna data zamówienia po Główne). */
  feedbackLines?: string[];
};
