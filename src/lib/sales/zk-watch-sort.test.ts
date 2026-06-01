import { describe, expect, it } from "vitest";
import { sortZkWatches } from "./zk-watch-sort";
import type { SalesZkWatch } from "@/types/database";

function watch(partial: Partial<SalesZkWatch> & Pick<SalesZkWatch, "id">): SalesZkWatch {
  return {
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "1/2026",
    client_label: "Klient",
    client_kh_id: null,
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
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...partial,
  };
}

describe("sortZkWatches", () => {
  it("stawia przypomnienia na dziś/wcześniej na górze, potem rosnąco po dacie przypomnienia", () => {
    const sorted = sortZkWatches(
      [
        watch({ id: "a", follow_up_at: "2026-06-01", created_at: "2026-05-01T00:00:00Z" }),
        watch({ id: "b", follow_up_at: "2026-05-10", created_at: "2026-05-02T00:00:00Z" }),
        watch({ id: "c", follow_up_at: null, created_at: "2026-05-03T00:00:00Z" }),
        watch({ id: "d", follow_up_at: "2026-05-20", created_at: "2026-05-04T00:00:00Z" }),
      ],
      Date.parse("2026-05-28T00:00:00")
    );
    expect(sorted.map((w) => w.id)).toEqual(["b", "d", "a", "c"]);
  });
});
