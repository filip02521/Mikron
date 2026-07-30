import { describe, expect, it } from "vitest";
import {
  buildZkDiffChangeLogEntries,
  isGadkiZkContentLogKind,
} from "./change-log-copy";
import type { ExternalWarehousePrunedSnapshot } from "./lines";

function snap(
  lines: { key: string; name: string; qty: number | null }[]
): ExternalWarehousePrunedSnapshot {
  return {
    dok_Id: 1,
    dok_NrPelny: "ZK 1",
    dok_Status: null,
    lines: lines.map((l) => ({
      key: l.key,
      tw_Symbol: null,
      tw_Nazwa: l.name,
      ob_Ilosc: l.qty,
      ob_TowId: null,
      ob_Id: null,
    })),
  };
}

describe("change-log-copy", () => {
  it("opisuje usunięcie pozycji z ilością", () => {
    const previous = snap([{ key: "ob:1", name: "Towar A", qty: 40 }]);
    const next = snap([]);
    const entries = buildZkDiffChangeLogEntries({
      siteId: "s",
      linkId: "l",
      zkNumber: "ZK 1",
      diff: {
        addedLineKeys: [],
        removedLineKeys: ["ob:1"],
        quantityChanged: [],
      },
      previous,
      next,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.summary).toBe(
      'ZK 1: usunięto z ZK „Towar A” (40 szt.)'
    );
    expect(isGadkiZkContentLogKind("lines_removed")).toBe(true);
    expect(isGadkiZkContentLogKind("pallet_changed")).toBe(false);
  });

  it("opisuje spadek ilości z delty", () => {
    const previous = snap([{ key: "ob:1", name: "Towar A", qty: 80 }]);
    const next = snap([{ key: "ob:1", name: "Towar A", qty: 40 }]);
    const entries = buildZkDiffChangeLogEntries({
      siteId: "s",
      linkId: "l",
      zkNumber: "ZK 1",
      diff: {
        addedLineKeys: [],
        removedLineKeys: [],
        quantityChanged: [{ key: "ob:1", from: 80, to: 40 }],
      },
      previous,
      next,
    });
    expect(entries[0]?.summary).toBe(
      'ZK 1: zmiana ilości „Towar A” 80 → 40 (-40 szt.)'
    );
  });
});
