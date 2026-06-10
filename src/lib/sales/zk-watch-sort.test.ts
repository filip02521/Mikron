import { describe, expect, it } from "vitest";
import {
  groupZkWatchesByMonth,
  sortZkWatches,
} from "./zk-watch-sort";
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
  it("sortuje po miesiącu rosnąco, wewnątrz miesiąca po numerze seryjnym rosnąco", () => {
    const sorted = sortZkWatches([
      watch({ id: "a", zk_number: "100/M/03/2026" }),
      watch({ id: "b", zk_number: "200/M/04/2026" }),
      watch({ id: "c", zk_number: "150/M/04/2026" }),
      watch({ id: "d", zk_number: "50/M/03/2026" }),
    ]);
    expect(sorted.map((w) => w.id)).toEqual(["d", "a", "c", "b"]);
  });

  it("przy tym samym numerze preferuje przypomnienia na dziś/wcześniej", () => {
    const sorted = sortZkWatches(
      [
        watch({
          id: "a",
          zk_number: "100/M/05/2026",
          follow_up_at: "2026-06-01",
        }),
        watch({
          id: "b",
          zk_number: "100/M/05/2026",
          follow_up_at: "2026-05-10",
        }),
        watch({ id: "c", zk_number: "200/M/05/2026", follow_up_at: null }),
      ],
      Date.parse("2026-05-28T00:00:00")
    );
    expect(sorted.map((w) => w.id)).toEqual(["b", "a", "c"]);
  });
});

describe("groupZkWatchesByMonth", () => {
  it("tworzy separatory po miesiącach", () => {
    const groups = groupZkWatchesByMonth([
      watch({ id: "a", zk_number: "100/M/03/2026" }),
      watch({ id: "b", zk_number: "200/M/04/2026" }),
      watch({ id: "c", zk_number: "150/M/04/2026" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["marzec 2026", "kwiecień 2026"]);
    expect(groups[0]?.watches.map((w) => w.id)).toEqual(["a"]);
    expect(groups[1]?.watches.map((w) => w.id)).toEqual(["c", "b"]);
  });
});
