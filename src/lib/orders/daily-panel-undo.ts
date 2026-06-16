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
  informacjaStockOutReorder: boolean | null;
  procurementCancelNote: string | null;
};

export type DailyPanelUndoToken =
  | { kind: "schedules"; snapshots: ScheduleSnapshot[] }
  | { kind: "individual"; snapshots: IndividualOrderSnapshot[] }
  | {
      kind: "combined";
      schedules: ScheduleSnapshot[];
      individuals: IndividualOrderSnapshot[];
    };

/** Wspólne okno cofania — toast UI i walidacja po stronie serwera. */
export const UNDO_WINDOW_MS = 10_000;

export const DAILY_PANEL_UNDO_MS = UNDO_WINDOW_MS;

export type DailyPanelUndoPayload = {
  token: DailyPanelUndoToken;
  performedAt: number;
  /** Koniec okna cofania — ustawiane na serwerze; fallback: performedAt + UNDO_WINDOW_MS. */
  expiresAt?: number;
};

export function buildDailyPanelUndoPayload(token: DailyPanelUndoToken): DailyPanelUndoPayload {
  const performedAt = Date.now();
  return {
    token,
    performedAt,
    expiresAt: performedAt + UNDO_WINDOW_MS,
  };
}

export function undoPayloadExpiresAt(payload: DailyPanelUndoPayload): number {
  return payload.expiresAt ?? payload.performedAt + UNDO_WINDOW_MS;
}

export function isUndoPayloadExpired(payload: DailyPanelUndoPayload, at = Date.now()): boolean {
  return at > undoPayloadExpiresAt(payload);
}

/** Koniec okna cofania od znacznika czasu (ms) — toast i klawiatura. */
export function undoExpiresAtFromAnchor(anchorMs: number): number {
  return anchorMs + UNDO_WINDOW_MS;
}

export function undoExpiresAtNow(anchorMs = Date.now()): number {
  return undoExpiresAtFromAnchor(anchorMs);
}

export function isUndoExpired(expiresAt: number, at = Date.now()): boolean {
  return at > expiresAt;
}

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
