import { describe, expect, it } from "vitest";
import {
  computeZkWatchSupplementSync,
  detectZkWatchSnapshotSyncChanges,
  zkWatchSnapshotFingerprint,
} from "./zk-watch-snapshot-sync";
import type { SalesZkWatch } from "@/types/database";

function watch(
  partial: Partial<SalesZkWatch> & Pick<SalesZkWatch, "id">
): SalesZkWatch {
  return {
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
        { ob_Id: 1, ob_TowId: 100, tw_Symbol: "A", tw_Nazwa: "Produkt A", ob_Ilosc: 1 },
      ],
    },
    line_checks: [],
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("zkWatchSnapshotFingerprint", () => {
  it("zmienia się gdy snapshot się zmienia", () => {
    const base = watch({ id: "w1" });
    const next = watch({
      id: "w1",
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 1, ob_TowId: 100, tw_Symbol: "A", tw_Nazwa: "Produkt A", ob_Ilosc: 1 },
          { ob_Id: 2, ob_TowId: 200, tw_Symbol: "B", tw_Nazwa: "Produkt B", ob_Ilosc: 1 },
        ],
      },
    });
    expect(zkWatchSnapshotFingerprint(base)).not.toBe(zkWatchSnapshotFingerprint(next));
  });
});

describe("detectZkWatchSnapshotSyncChanges", () => {
  it("wykrywa nową pozycję po aktualizacji snapshotu z serwera", () => {
    const previous = watch({ id: "w1", updated_at: "2026-01-01T00:00:00Z" });
    const next = watch({
      id: "w1",
      updated_at: "2026-01-02T00:00:00Z",
      subiekt_snapshot: {
        dok_Pozycja: [
          { ob_Id: 1, ob_TowId: 100, tw_Symbol: "A", tw_Nazwa: "Produkt A", ob_Ilosc: 1 },
          { ob_Id: 2, ob_TowId: 200, tw_Symbol: "B", tw_Nazwa: "Produkt B", ob_Ilosc: 1 },
        ],
      },
    });

    const changes = detectZkWatchSnapshotSyncChanges([previous], [next]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.diff.addedLineKeys).toEqual(["ob:2"]);
  });

  it("ignoruje starszą wersję z serwera", () => {
    const previous = watch({ id: "w1", updated_at: "2026-01-03T00:00:00Z" });
    const next = watch({ id: "w1", updated_at: "2026-01-01T00:00:00Z" });
    expect(detectZkWatchSnapshotSyncChanges([previous], [next])).toEqual([]);
  });

  it("ignoruje zamknięte ZK", () => {
    const previous = watch({ id: "w1" });
    const next = watch({ id: "w1", closed_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" });
    expect(detectZkWatchSnapshotSyncChanges([previous], [next])).toEqual([]);
  });
});

describe("computeZkWatchSupplementSync", () => {
  it("nie proponuje promptu gdy nowe klucze są już w snapshotcie", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: mockStorage },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mockStorage,
    });

    try {
      const w = watch({
        id: "w1",
        subiekt_snapshot: {
          dok_Pozycja: [
            { ob_Id: 1, ob_TowId: 100, tw_Symbol: "A", tw_Nazwa: "Produkt A", ob_Ilosc: 1 },
            { ob_Id: 2, ob_TowId: 200, tw_Symbol: "B", tw_Nazwa: "Produkt B", ob_Ilosc: 1 },
          ],
        },
      });
      const diff = {
        addedLineKeys: ["ob:2"],
        removedLineKeys: [],
        quantityChanged: [],
      };

      const result = computeZkWatchSupplementSync({
        watch: w,
        diff,
        orders: [],
        salesPersonId: "sp1",
        existingNewLineKeys: ["ob:2"],
      });

      expect(result.shouldPrompt).toBe(false);
      expect(result.newlyUncoveredAdded).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
