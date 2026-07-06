import { describe, expect, it } from "vitest";
import type { SalesZkWatch } from "@/types/database";
import { formatPln, shouldShowZkWatchSubiektRealizedCloseHint } from "./notepad-format";

function watch(partial: Partial<SalesZkWatch> = {}): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp1",
    zk_number: "ZK 1/M/06/2026",
    client_label: "Klient",
    client_kh_id: null,
    subiekt_dok_id: 1,
    subiekt_snapshot: { dok_Status: 8 },
    line_checks: [],
    line_summary: null,
    note: null,
    follow_up_at: null,
    zk_issued_at: "2026-06-01",
    amount_net: null,
    amount_gross: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-06-01",
    updated_at: "2026-06-01",
    ...partial,
  };
}

describe("formatPln", () => {
  it("formatuje liczbę i string z bazy", () => {
    expect(formatPln(1230)).toContain("1");
    expect(formatPln("1230.50")).toContain("1");
    expect(formatPln(null)).toBe("—");
  });
});

describe("shouldShowZkWatchSubiektRealizedCloseHint", () => {
  it("nie pokazuje baneru dla świeżego ZK bez zakresu prośby", () => {
    expect(
      shouldShowZkWatchSubiektRealizedCloseHint(watch(), {
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineViews: [
          {
            key: "l1",
            product: "Towar",
            symbol: "A",
            quantity: 1,
            quantityLabel: "1 szt.",
            subiektTwId: 100,
            arrived: false,
            shelf_marked: false,
            completed_manually: false,
          },
        ],
      })
    ).toBe(false);
  });

  it("pokazuje baner gdy Subiekt Zrealizowane i wszystkie pozycje domknięte", () => {
    expect(
      shouldShowZkWatchSubiektRealizedCloseHint(
        watch({
          line_checks: [{ key: "l1", arrived: false, needs_prosba: true }],
        }),
        {
          newLineKeys: [],
          inStockLineKeys: ["l1"],
          scopeExcludedLineKeys: [],
          lineCoverageByKey: { l1: "delivered" },
          lineViews: [
            {
              key: "l1",
              product: "Towar",
              symbol: "A",
              quantity: 1,
              quantityLabel: "1 szt.",
              subiektTwId: 100,
              arrived: false,
              shelf_marked: false,
              completed_manually: false,
            },
          ],
        }
      )
    ).toBe(true);
  });
});
