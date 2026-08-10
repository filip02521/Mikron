import { afterEach, describe, expect, it } from "vitest";
import {
  buildDailyPanelUndoPayload,
  UNDO_WINDOW_MS,
} from "@/lib/orders/daily-panel-undo";
import {
  clearDailyPanelUndo,
  consumeDailyPanelUndoRefreshFlag,
  getDailyPanelUndoServerSnapshot,
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

    const snap = getDailyPanelUndoSnapshot();
    expect(snap?.title).toBe("Oznaczono jako zamówienie główne");
    expect(snap?.payload.token).toEqual(payload.token);
    expect(snap?.expiresAt).toBe(snap!.payload.performedAt + UNDO_WINDOW_MS);
    expect(peekDailyPanelUndoRefreshFlag()).toBe(true);

    // Symulacja remount: odczyt ze store bez setState w komponencie
    expect(getDailyPanelUndoSnapshot()?.expiresAt).toBe(
      snap!.payload.performedAt + UNDO_WINDOW_MS
    );
    // getServerSnapshot = getSnapshot — inaczej remount po revalidate zeruje toast
    expect(getDailyPanelUndoServerSnapshot()).toEqual(getDailyPanelUndoSnapshot());
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
