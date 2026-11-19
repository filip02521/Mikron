import { describe, expect, it } from "vitest";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { groupZkWatchesForList, ZK_TODO_GROUP_KEY, zkWatchNeedsAction } from "./zk-watch-todo-group";

function watch(id: string, zkNumber: string, extra: Partial<SalesZkWatch> = {}): SalesZkWatch {
  return {
    id,
    zk_number: zkNumber,
    zk_issued_at: null,
    created_at: "2026-08-01T10:00:00.000Z",
    follow_up_at: null,
    line_summary: "Towar testowy",
    line_checks: null,
    lines: null,
    ...extra,
  } as unknown as SalesZkWatch;
}

function hints(extra: Partial<ZkWatchOrderHints> = {}): ZkWatchOrderHints {
  return {
    matchingOpenRequestCount: 0,
    matchingOpenRequestIds: [],
    matchedDeliveredLineKeys: [],
    allLinesMatchedByOrders: false,
    lineCoverageByKey: {},
    uncoveredLineKeys: [],
    openProsbaCoveredLineKeys: [],
    prosbaScopeConfigured: true,
    inStockLineKeys: [],
    regalWaitingLineKeys: [],
    informacjaReadyLineKeys: [],
    informacjaAcknowledgedLineKeys: [],
    scopeExcludedLineKeys: [],
    ...extra,
  };
}

describe("zkWatchNeedsAction", () => {
  it("pozycja bez prośby, towar na regale, dostępność i przypomnienie po terminie wymagają działania", () => {
    const w = watch("a", "100/M/08/2026");
    expect(zkWatchNeedsAction(w, hints({ uncoveredLineKeys: ["1"] }))).toBe(true);
    expect(zkWatchNeedsAction(w, hints({ regalWaitingLineKeys: ["1"] }))).toBe(true);
    expect(zkWatchNeedsAction(w, hints({ informacjaReadyLineKeys: ["1"] }))).toBe(true);
    expect(
      zkWatchNeedsAction(watch("b", "101/M/08/2026", { follow_up_at: "2026-01-01" }), hints(), Date.parse("2026-11-12"))
    ).toBe(true);
  });
});

describe("groupZkWatchesForList", () => {
  const waiting = watch("w", "200/M/08/2026");
  const todo = watch("t", "300/M/09/2026");
  const hintsById = new Map([
    ["w", hints({ openProsbaCoveredLineKeys: ["1"] })],
    ["t", hints({ uncoveredLineKeys: ["1"] })],
  ]);

  it("ZK wymagające działania idą do pierwszej grupy, reszta zostaje w miesiącach", () => {
    const groups = groupZkWatchesForList([waiting, todo], hintsById);
    expect(groups[0]?.key).toBe(ZK_TODO_GROUP_KEY);
    expect(groups[0]?.watches.map((x) => x.id)).toEqual(["t"]);
    expect(groups.slice(1).flatMap((g) => g.watches.map((x) => x.id))).not.toContain("t");
    // Każdy ZK dokładnie raz.
    expect(groups.flatMap((g) => g.watches).length).toBe(2);
  });

  it("archiwum grupuje tylko po miesiącach", () => {
    const groups = groupZkWatchesForList([waiting, todo], hintsById, { archived: true });
    expect(groups.some((g) => g.key === ZK_TODO_GROUP_KEY)).toBe(false);
  });
});
