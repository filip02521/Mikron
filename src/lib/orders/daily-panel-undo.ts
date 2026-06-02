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

export const DAILY_PANEL_UNDO_MS = 5_000;

export type DailyPanelActionResult = {
  success: true;
  undo?: DailyPanelUndoPayload;
  /** Krótkie linie do toastu (np. kolejna data zamówienia po Główne). */
  feedbackLines?: string[];
};
