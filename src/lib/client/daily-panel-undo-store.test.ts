import { afterEach, describe, expect, it } from "vitest";
import {
  buildDailyPanelUndoPayload,
  UNDO_WINDOW_MS,
} from "@/lib/orders/daily-panel-undo";
import {
  clearDailyPanelUndo,
  consumeDailyPanelUndoRefreshFlag,
  getDailyPanelUndoSnapshot,
  peekDailyPanelUndoRefreshFlag,
  pruneExpiredDailyPanelUndo,
  resetDailyPanelUndoStoreForTests,
  setDailyPanelUndoFromAction,
} from "@/lib/client/daily-panel-undo-store";

describe("daily-panel-undo-store", () => {
  afterEach(() => {
    resetDailyPanelUndoStoreForTests();
  });

  it("przechowuje undo poza Reactem (przeżywa remount)", () => {
    const payload = buildDailyPanelUndoPayload({
      kind: "individual",
      snapshots: [
        {
          orderId: "o1",
          status: "Nowe",
          orderType: null,
          orderedAt: null,
          placementGroupId: null,
          procurementSeenAt: null,
          informacjaQueueViaDailyPanel: null,
          informacjaStockOutReorder: null,
          procurementCancelNote: null,
        },
      ],
    });

    setDailyPanelUndoFromAction({
      title: "Oznaczono jako zamówienie główne",
      description: "Masz 10 sekund na cofnięcie.",
      payload,
    });

    expect(getDailyPanelUndoSnapshot()?.title).toBe(
      "Oznaczono jako zamówienie główne"
    );
    expect(getDailyPanelUndoSnapshot()?.payload).toEqual(payload);
    expect(peekDailyPanelUndoRefreshFlag()).toBe(true);

    // Symulacja remount: odczyt ze store bez setState w komponencie
    expect(getDailyPanelUndoSnapshot()?.expiresAt).toBe(
      payload.performedAt + UNDO_WINDOW_MS
    );
  });

  it("consumeDailyPanelUndoRefreshFlag czyści flagę jednorazowo", () => {
    const payload = buildDailyPanelUndoPayload({
      kind: "procurement_flags",
      snapshots: [
        {
          orderId: "o1",
          procurementFlag: null,
          procurementFlagNote: null,
          procurementFlagUpdatedAt: null,
          procurementFlagUpdatedBy: null,
        },
      ],
    });
    setDailyPanelUndoFromAction({ title: "Zapisano flagę", payload });
    expect(consumeDailyPanelUndoRefreshFlag()).toBe(true);
    expect(consumeDailyPanelUndoRefreshFlag()).toBe(false);
  });

  it("pruneExpiredDailyPanelUndo usuwa wygasły stan", () => {
    const payload = buildDailyPanelUndoPayload({
      kind: "individual",
      snapshots: [],
    });
    setDailyPanelUndoFromAction({ title: "x", payload });
    expect(
      pruneExpiredDailyPanelUndo(payload.performedAt + UNDO_WINDOW_MS + 1)
    ).toBe(true);
    expect(getDailyPanelUndoSnapshot()).toBeNull();
  });

  it("clearDailyPanelUndo nie zjada flagi refresh (dismiss ją konsumuje osobno)", () => {
    const payload = buildDailyPanelUndoPayload({
      kind: "schedules",
      snapshots: [],
    });
    setDailyPanelUndoFromAction({ title: "Zamówione", payload });
    clearDailyPanelUndo();
    expect(getDailyPanelUndoSnapshot()).toBeNull();
    expect(peekDailyPanelUndoRefreshFlag()).toBe(true);
  });
});
