import { describe, expect, it } from "vitest";
import {
  applyZkWatchRefreshNewLines,
  mergeLineKeys,
  pruneNewLineKeysForWatch,
  reconcileZkNewLinesSnapshot,
} from "./zk-watch-new-lines-state";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

const watch: SalesZkWatch = {
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK/1",
  client_label: "Klient",
  client_kh_id: 1,
  amount_net: null,
  amount_gross: null,
  zk_issued_at: null,
  note: null,
  line_summary: null,
  subiekt_snapshot: {
    dok_Pozycja: [
      { tw_Nazwa: "A", tw_Symbol: "A-1", ob_Ilosc: 1, ob_TowId: 1, ob_Id: 1 },
      { tw_Nazwa: "B", tw_Symbol: "B-1", ob_Ilosc: 1, ob_TowId: 2, ob_Id: 2 },
      { tw_Nazwa: "C", tw_Symbol: "C-1", ob_Ilosc: 1, ob_TowId: 3, ob_Id: 3 },
    ],
  },
  line_checks: [],
  follow_up_at: null,
  closed_at: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
};

const hints: ZkWatchOrderHints = {
  matchingOpenRequestCount: 0,
  matchingOpenRequestIds: [],
  matchedDeliveredLineKeys: [],
  allLinesMatchedByOrders: false,
  lineCoverageByKey: {},
  uncoveredLineKeys: ["ob:2", "ob:3"],
  openProsbaCoveredLineKeys: [],
  prosbaScopeConfigured: true,
  inStockLineKeys: [],
  regalWaitingLineKeys: [],
  scopeExcludedLineKeys: [],
};

describe("zk-watch-new-lines-state", () => {
  it("mergeLineKeys łączy bez duplikatów", () => {
    expect(mergeLineKeys(["ob:1"], ["ob:2", "ob:1"])).toEqual(["ob:1", "ob:2"]);
  });

  it("pruneNewLineKeysForWatch zostawia tylko odkryte i istniejące linie", () => {
    const valid = new Set(["ob:1", "ob:2", "ob:3"]);
    expect(
      pruneNewLineKeysForWatch(["ob:1", "ob:2", "ob:99"], ["ob:2", "ob:3"], valid)
    ).toEqual(["ob:2"]);
  });

  it("reconcileZkNewLinesSnapshot usuwa pokryte i zamknięte sprawy", () => {
    const closedWatch = { ...watch, id: "w2", closed_at: "2026-01-01" };
    const reconciled = reconcileZkNewLinesSnapshot({
      snapshot: {
        w1: ["ob:2", "ob:3"],
        w2: ["ob:1"],
      },
      watches: [watch, closedWatch],
      hintsByWatchId: new Map([[watch.id, hints]]),
    });
    expect(reconciled).toEqual({ w1: ["ob:2", "ob:3"] });
  });

  it("reconcileZkNewLinesSnapshot usuwa klucze już pokryte prośbą", () => {
    const reconciled = reconcileZkNewLinesSnapshot({
      snapshot: { w1: ["ob:2", "ob:3"] },
      watches: [watch],
      hintsByWatchId: new Map([
        [
          watch.id,
          {
            ...hints,
            uncoveredLineKeys: ["ob:3"],
          },
        ],
      ]),
    });
    expect(reconciled).toEqual({ w1: ["ob:3"] });
  });

  it("applyZkWatchRefreshNewLines scala kolejne refresh i usuwa skasowane linie", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: mockStorage },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mockStorage,
    });

    try {
      storage.set(
        "notatnik-zk-new-lines-sp1",
        JSON.stringify({ w1: ["ob:2"] })
      );

      const merged = applyZkWatchRefreshNewLines({
        salesPersonId: "sp1",
        watchId: "w1",
        diff: { addedLineKeys: ["ob:3"], removedLineKeys: ["ob:1"], quantityChanged: [] },
        uncoveredAdded: ["ob:3"],
        uncoveredLineKeys: ["ob:2", "ob:3"],
        validLineKeys: new Set(["ob:2", "ob:3"]),
      });

      expect(merged).toEqual(["ob:2", "ob:3"]);
      expect(JSON.parse(storage.get("notatnik-zk-new-lines-sp1")!)).toEqual({
        w1: ["ob:2", "ob:3"],
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
