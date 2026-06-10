import { describe, expect, it } from "vitest";
import {
  buildZkArrivedSnapshot,
  computeZkWatchActivityVersion,
  countArrivedZkLinesFromWatch,
  detectUnseenZkWarehouseArrivals,
} from "./zk-watch-warehouse-notify";
import type { SalesZkWatch } from "@/types/database";

function watch(partial: Partial<SalesZkWatch>): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp",
    zk_number: "1/ZK/01/2026",
    client_label: "Klinika",
    line_checks: [],
    closed_at: null,
    archived_at: null,
    updated_at: "2026-06-09T10:00:00Z",
    ...partial,
  } as SalesZkWatch;
}

describe("countArrivedZkLinesFromWatch", () => {
  it("liczy odhaczone pozycje", () => {
    expect(
      countArrivedZkLinesFromWatch({
        line_checks: [
          { key: "a", arrived: true },
          { key: "b", arrived: false },
        ],
      })
    ).toBe(1);
  });
});

describe("detectUnseenZkWarehouseArrivals", () => {
  it("wykrywa nowe odhaczenia względem snapshotu", () => {
    const watches = [
      watch({
        id: "w1",
        line_checks: [
          { key: "a", arrived: true },
          { key: "b", arrived: true },
        ],
      }),
      watch({ id: "w2", line_checks: [{ key: "c", arrived: false }] }),
    ];
    expect(detectUnseenZkWarehouseArrivals(watches, { w1: 1, w2: 0 })).toEqual(["w1"]);
    expect(buildZkArrivedSnapshot(watches)).toEqual({ w1: 2, w2: 0 });
  });
});

describe("computeZkWatchActivityVersion", () => {
  it("zmienia się przy nowszym updated_at lub liczbie odhaczeń", () => {
    const a = computeZkWatchActivityVersion([
      { updated_at: "2026-06-01T10:00:00Z", line_checks: [] },
    ]);
    const b = computeZkWatchActivityVersion([
      {
        updated_at: "2026-06-09T10:00:00Z",
        line_checks: [{ key: "a", arrived: true }],
      },
    ]);
    expect(a).not.toBe(b);
  });
});
