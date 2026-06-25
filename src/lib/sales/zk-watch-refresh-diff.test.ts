import { describe, expect, it } from "vitest";
import {
  addedLineKeysForSupplementPrompt,
  computeZkWatchRefreshDiff,
  shouldPromptZkRefreshSupplement,
  shouldRedirectZkRefreshToOpenProsba,
  uncoveredAddedLineKeys,
} from "./zk-watch-refresh-diff";
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

describe("computeZkWatchRefreshDiff", () => {
  it("wykrywa nowe i usunięte pozycje", () => {
    const previous = watch({
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 1 }],
      },
    });
    const next = watch({
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 1 },
          { ob_Id: 12, tw_Nazwa: "Uszczelka", ob_Ilosc: 2 },
        ],
      },
    });

    const diff = computeZkWatchRefreshDiff(previous, next);
    expect(diff.addedLineKeys).toEqual(["ob:12"]);
    expect(diff.removedLineKeys).toEqual([]);
    expect(diff.quantityChanged).toEqual([]);
  });

  it("wykrywa zmianę ilości", () => {
    const previous = watch({
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 2 }],
      },
    });
    const next = watch({
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 5 }],
      },
    });

    const diff = computeZkWatchRefreshDiff(previous, next);
    expect(diff.addedLineKeys).toEqual([]);
    expect(diff.quantityChanged).toEqual([{ key: "ob:10", from: 2, to: 5 }]);
  });

  it("pomija koszty przesyłki", () => {
    const previous = watch({
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 1 }],
      },
    });
    const next = watch({
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 10, tw_Nazwa: "Filtr", ob_Ilosc: 1 },
          {
            ob_Id: 11,
            tw_Nazwa: "pakowanie przesyłki",
            tw_Symbol: "KOSZTY/2",
            ob_Ilosc: 1,
          },
        ],
      },
    });

    const diff = computeZkWatchRefreshDiff(previous, next);
    expect(diff.addedLineKeys).toEqual([]);
  });
});

describe("shouldPromptZkRefreshSupplement", () => {
  it("proponuje uzupełnienie tylko gdy nowe linie są niepokryte prośbą", () => {
    const previous = watch({
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "A", ob_Ilosc: 1 }],
      },
    });
    const next = watch({
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 10, tw_Nazwa: "A", ob_Ilosc: 1 },
          { ob_Id: 11, tw_Nazwa: "B", ob_Ilosc: 1 },
        ],
      },
    });
    const diff = computeZkWatchRefreshDiff(previous, next);

    expect(
      shouldPromptZkRefreshSupplement({
        diff,
        watch: next,
        uncoveredLineKeys: ["ob:11"],
      })
    ).toBe(true);
    expect(
      shouldPromptZkRefreshSupplement({
        diff,
        watch: next,
        uncoveredLineKeys: [],
      })
    ).toBe(true);
    expect(uncoveredAddedLineKeys(diff, ["ob:11", "ob:99"])).toEqual(["ob:11"]);
  });

  it("nie proponuje pozycji jawnie oznaczonych jako na stanie", () => {
    const previous = watch({
      line_checks: [{ key: "ob:10", arrived: false, needs_prosba: true }],
      subiekt_snapshot: {
        dok_Pozycja: [{ ob_Id: 10, tw_Nazwa: "A", ob_Ilosc: 1 }],
      },
    });
    const next = watch({
      line_checks: [
        { key: "ob:10", arrived: false, needs_prosba: true },
        { key: "ob:11", arrived: false, needs_prosba: false },
      ],
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 10, tw_Nazwa: "A", ob_Ilosc: 1 },
          { ob_Id: 11, tw_Nazwa: "B", ob_Ilosc: 1 },
        ],
      },
    });
    const diff = computeZkWatchRefreshDiff(previous, next);

    expect(
      addedLineKeysForSupplementPrompt(diff, next, [])
    ).toEqual([]);
  });
});

describe("shouldRedirectZkRefreshToOpenProsba", () => {
  it("nie przekierowuje gdy użytkownik zaznaczył pozycje mimo stanu", () => {
    expect(
      shouldRedirectZkRefreshToOpenProsba({
        allOnStock: true,
        hasOpenMatchingProsba: true,
        linesToAddCount: 2,
      })
    ).toBe(false);
  });

  it("przekierowuje tylko gdy brak pozycji do dodania", () => {
    expect(
      shouldRedirectZkRefreshToOpenProsba({
        allOnStock: true,
        hasOpenMatchingProsba: true,
        linesToAddCount: 0,
      })
    ).toBe(true);
  });
});
