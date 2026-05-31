import { describe, expect, it } from "vitest";
import { partitionSalesZkWatches } from "@/lib/data/sales-notepad";
import { watchNeedsNotepadAttention } from "@/lib/sales/notepad-follow-up";
import { collectNotepadTodayTasks } from "@/lib/sales/notepad-today-tasks";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import type { SalesZkWatch } from "@/types/database";

function watch(partial: Partial<SalesZkWatch> & Pick<SalesZkWatch, "id">): SalesZkWatch {
  return {
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK/1",
    client_label: "Klient",
    client_kh_id: null,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: null,
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...partial,
  };
}

describe("ZK czeka na towar — logika notatnika", () => {
  it("partitionSalesZkWatches rozdziela aktywne i archiwum", () => {
    const { zkWatches, archivedZkWatches } = partitionSalesZkWatches([
      watch({ id: "active", zk_number: "A" }),
      watch({ id: "closed", closed_at: "2026-05-10T00:00:00Z" }),
      watch({ id: "archived", archived_at: "2026-05-11T00:00:00Z" }),
    ]);
    expect(zkWatches.map((w) => w.id)).toEqual(["active"]);
    expect(archivedZkWatches.map((w) => w.id)).toEqual(["closed", "archived"]);
  });

  it("watchNeedsNotepadAttention ignoruje zamknięte ZK", () => {
    const ref = Date.parse("2026-05-28T00:00:00");
    expect(
      watchNeedsNotepadAttention(
        watch({ id: "fu", follow_up_at: "2026-05-20" }),
        ref
      )
    ).toBe(true);
    expect(
      watchNeedsNotepadAttention(
        watch({ id: "closed", follow_up_at: "2026-05-20", closed_at: "2026-05-27T00:00:00Z" }),
        ref
      )
    ).toBe(false);
  });

  it("collectNotepadTodayTasks nie zbiera zamkniętych ZK", () => {
    const tasks = collectNotepadTodayTasks(
      [watch({ id: "closed-fu", follow_up_at: "2026-05-20", closed_at: "2026-05-27T00:00:00Z" })],
      []
    );
    expect(tasks).toHaveLength(0);
  });

  it("sortZkWatches preferuje przypomnienia na dziś/wcześniej", () => {
    const ref = Date.parse("2026-05-28T00:00:00");
    const sorted = sortZkWatches(
      [
        watch({ id: "later", follow_up_at: "2026-06-01" }),
        watch({ id: "due", follow_up_at: "2026-05-20" }),
        watch({ id: "none" }),
      ],
      ref
    );
    expect(sorted.map((w) => w.id)).toEqual(["due", "later", "none"]);
  });
});
