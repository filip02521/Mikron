import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  partitionMyOrderRowsBySalesAction,
  rowMatchesInboxFilter,
  rowNeedsSalesAction,
} from "@/lib/orders/my-order-inbox-filter";

function row(partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">): MyOrderRow {
  const { id, ...rest } = partial;
  return {
    id,
    kind: "zamowienie",
    requestKind: "zamowienie",
    statusTitle: "Zamówione",
    statusDetail: null,
    submittedLabel: "2026-01-01",
    clientLabel: null,
    lineCount: 1,
    pickupPendingCount: 0,
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    acknowledgeMode: null,
    timingLabel: null,
    progressLabel: null,
    headline: "Czekamy",
    headlineTone: "neutral",
    subline: null,
    rowColor: "white",
    badgeVariant: "blue",
    ...rest,
  } as MyOrderRow;
}

describe("rowNeedsSalesAction", () => {
  it("true przy odbiorze", () => {
    expect(
      rowNeedsSalesAction(
        row({
          id: "1",
          acknowledgeMode: "pickup",
          pickupPendingCount: 1,
          statusTitle: "Do odbioru",
        })
      )
    ).toBe(true);
  });

  it("false przy zamówionym bez akcji", () => {
    expect(rowNeedsSalesAction(row({ id: "2", statusTitle: "Zamówione" }))).toBe(false);
  });
});

describe("partitionMyOrderRowsBySalesAction", () => {
  it("dzieli listę na potwierdzenie i resztę", () => {
    const a = row({
      id: "a",
      acknowledgeMode: "pickup",
      pickupPendingCount: 1,
      statusTitle: "Do odbioru",
    });
    const b = row({ id: "b", statusTitle: "Zamówione" });
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction([b, a]);
    expect(needsAction.map((r) => r.id)).toEqual(["a"]);
    expect(inProgress.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("action_group / watch_group", () => {
  it("action_group obejmuje prośby wymagające reakcji", () => {
    const pickup = row({
      id: "p",
      acknowledgeMode: "pickup",
      pickupPendingCount: 1,
      statusTitle: "Do odbioru",
    });
    const waiting = row({ id: "w", statusTitle: "Zamówione" });
    expect(rowMatchesInboxFilter(pickup, "action_group")).toBe(true);
    expect(rowMatchesInboxFilter(waiting, "action_group")).toBe(false);
    expect(filterMyOrderRows([pickup, waiting], "action_group").map((r) => r.id)).toEqual([
      "p",
    ]);
  });

  it("watch_group obejmuje prośby w toku", () => {
    const waiting = row({ id: "w", statusTitle: "Zamówione" });
    const pickup = row({
      id: "p",
      acknowledgeMode: "pickup",
      pickupPendingCount: 1,
      statusTitle: "Do odbioru",
    });
    expect(rowMatchesInboxFilter(waiting, "watch_group")).toBe(true);
    expect(rowMatchesInboxFilter(pickup, "watch_group")).toBe(false);
  });
});
