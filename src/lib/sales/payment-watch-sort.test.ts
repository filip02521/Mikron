import { describe, expect, it } from "vitest";
import { isPaymentWatchOverdue, sortPaymentWatches } from "./payment-watch-sort";
import type { SalesPaymentWatch } from "@/types/database";

function watch(partial: Partial<SalesPaymentWatch> & Pick<SalesPaymentWatch, "id">): SalesPaymentWatch {
  return {
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "1/2026",
    client_label: "Klient",
    client_kh_id: null,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    due_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: null,
    settled_at: null,
    archived_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...partial,
  };
}

describe("sortPaymentWatches", () => {
  it("stawia przeterminowane na górze, potem po terminie rosnąco", () => {
    const sorted = sortPaymentWatches(
      [
        watch({ id: "a", due_at: "2026-06-01", created_at: "2026-05-01T00:00:00Z" }),
        watch({ id: "b", due_at: "2026-05-10", created_at: "2026-05-02T00:00:00Z" }),
        watch({ id: "c", due_at: null, created_at: "2026-05-03T00:00:00Z" }),
        watch({ id: "d", due_at: "2026-05-20", created_at: "2026-05-04T00:00:00Z" }),
      ],
      Date.parse("2026-05-28T00:00:00")
    );
    expect(sorted.map((w) => w.id)).toEqual(["b", "d", "a", "c"]);
    expect(
      isPaymentWatchOverdue(sorted[0]!, Date.parse("2026-05-28T00:00:00"))
    ).toBe(true);
  });
});
