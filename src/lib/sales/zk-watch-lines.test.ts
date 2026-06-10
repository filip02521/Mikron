import { describe, expect, it } from "vitest";
import {
  allZkWatchLinesArrived,
  buildZkWatchLineViews,
  formatZkLinesPreview,
  formatZkLinesShort,
  isZkWatchShippingCostLine,
  mergeLineChecksAfterRefresh,
  zkLineKey,
} from "./zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

function watch(partial: Partial<SalesZkWatch>): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp",
    subiekt_dok_id: 1,
    zk_number: "ZK 1",
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
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("zk-watch-lines", () => {
  it("buduje widoki z pozycji Subiekta", () => {
    const views = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: {
          dok_Pozycja: [
            { ob_Id: 10, tw_Nazwa: "Filtr", tw_Symbol: "F-1", ob_Ilosc: 2 },
            { ob_Id: 11, tw_Nazwa: "Uszczelka", ob_Ilosc: 1 },
          ],
        },
        line_checks: [{ key: "ob:10", arrived: true }],
      })
    );
    expect(views).toHaveLength(2);
    expect(views[0]?.arrived).toBe(true);
    expect(views[1]?.arrived).toBe(false);
    expect(views[0]?.quantityLabel).toBe("2 szt.");
    expect(views[0]?.quantity).toBe(2);
  });

  it("scala stan po odświeżeniu", () => {
    const merged = mergeLineChecksAfterRefresh(
      [{ key: "ob:10", arrived: true }],
      buildZkWatchLineViews(
        watch({
          subiekt_snapshot: {
            dok_Pozycja: [
              { ob_Id: 10, tw_Nazwa: "A" },
              { ob_Id: 12, tw_Nazwa: "B" },
            ],
          },
        })
      )
    );
    expect(merged).toEqual([
      { key: "ob:10", arrived: true },
      { key: "ob:12", arrived: false },
    ]);
  });

  it("zkLineKey jest stabilny dla ob_Id", () => {
    expect(zkLineKey({ ob_Id: 99, tw_Nazwa: "X" }, 0)).toBe("ob:99");
  });

  it("pomija koszty przesyłki (KOSZTY/* i pakowanie)", () => {
    const views = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: {
          dok_Pozycja: [
            { ob_Id: 10, tw_Nazwa: "Szczotka", tw_Symbol: "32/90 KK", ob_Ilosc: 7 },
            {
              ob_Id: 11,
              tw_Nazwa: "pakowanie przesyłki/przygotowanie/zabezpieczenie",
              tw_Symbol: "KOSZTY/1",
              ob_Ilosc: 1,
            },
            {
              ob_Id: 12,
              tw_Nazwa: "pakowanie przesyłki/koszty dostawy",
              tw_Symbol: "KOSZTY/2",
              ob_Ilosc: 1,
            },
          ],
        },
        line_checks: [
          { key: "ob:10", arrived: false },
          { key: "ob:11", arrived: true },
        ],
      })
    );
    expect(views).toHaveLength(1);
    expect(views[0]?.product).toBe("Szczotka");
    expect(isZkWatchShippingCostLine({ tw_Symbol: "KOSZTY/1" })).toBe(true);
    expect(isZkWatchShippingCostLine({ tw_Nazwa: "Filtr", tw_Symbol: "F-1" })).toBe(false);
  });

  it("allZkWatchLinesArrived wymaga wszystkich pozycji na miejscu", () => {
    const partial = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: { dok_Pozycja: [{ ob_Id: 1 }, { ob_Id: 2 }] },
        line_checks: [{ key: "ob:1", arrived: true }],
      })
    );
    expect(allZkWatchLinesArrived(partial)).toBe(false);

    const complete = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: { dok_Pozycja: [{ ob_Id: 1 }, { ob_Id: 2 }] },
        line_checks: [
          { key: "ob:1", arrived: true },
          { key: "ob:2", arrived: true },
        ],
      })
    );
    expect(allZkWatchLinesArrived(complete)).toBe(true);
    expect(allZkWatchLinesArrived([])).toBe(false);
  });

  it("formatZkLinesShort zwraca arrived/total", () => {
    const views = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: { dok_Pozycja: [{ ob_Id: 1 }, { ob_Id: 2 }, { ob_Id: 3 }] },
        line_checks: [{ key: "ob:1", arrived: true }],
      })
    );
    expect(formatZkLinesShort(views)).toBe("1/3");
    expect(formatZkLinesShort([])).toBeNull();
  });

  it("formatZkLinesPreview pokazuje pierwszą brakującą pozycję i licznik", () => {
    const views = buildZkWatchLineViews(
      watch({
        subiekt_snapshot: {
          dok_Pozycja: [
            { ob_Id: 1, tw_Nazwa: "Filtr ABC" },
            { ob_Id: 2, tw_Nazwa: "Bonding" },
          ],
        },
        line_checks: [{ key: "ob:1", arrived: true }],
      })
    );
    expect(formatZkLinesPreview(views)).toBe("Bonding · 1/2");
  });
});
