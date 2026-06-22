import { describe, expect, it } from "vitest";
import {
  buildZkWatchListVirtualItems,
  zkWatchListScrollKey,
} from "./zk-watch-list-virtual";
import type { ZkWatchMonthGroup } from "@/lib/sales/zk-watch-sort";
import type { SalesZkWatch } from "@/types/database";

function watch(id: string): SalesZkWatch {
  return {
    id,
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: `ZK/${id}`,
    client_label: "Klient",
    client_kh_id: 1,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: null,
    line_checks: [],
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

function group(key: string, watchIds: string[]): ZkWatchMonthGroup {
  return {
    key,
    label: key,
    watches: watchIds.map((id) => watch(id)),
  };
}

describe("buildZkWatchListVirtualItems", () => {
  it("zawiera nagłówki miesięcy i karty z rozwiniętych grup", () => {
    const groups = [group("2026-01", ["a", "b"]), group("2025-12", ["c"])];
    const items = buildZkWatchListVirtualItems({
      groups,
      collapsedMonths: new Set(["2025-12"]),
      openModalWatchId: null,
    });

    expect(items.map((i) => i.key)).toEqual([
      "month:2026-01",
      "watch:a",
      "watch:b",
      "month:2025-12",
    ]);
  });

  it("utrzymuje kartę z otwartym modalem mimo zwiniętego miesiąca", () => {
    const groups = [group("2026-01", ["a", "b"])];
    const items = buildZkWatchListVirtualItems({
      groups,
      collapsedMonths: new Set(["2026-01"]),
      openModalWatchId: "b",
    });

    expect(items.map((i) => i.key)).toEqual(["month:2026-01", "watch:b"]);
  });

  it("zkWatchListScrollKey", () => {
    expect(zkWatchListScrollKey("abc")).toBe("watch:abc");
  });
});
