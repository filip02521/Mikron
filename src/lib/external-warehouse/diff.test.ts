import { describe, expect, it } from "vitest";
import {
  computeExternalWarehouseRefreshDiff,
  hasExternalWarehouseRefreshDiff,
} from "./diff";
import type { ExternalWarehousePrunedSnapshot } from "./lines";

function snap(
  lines: { key: string; qty: number | null }[]
): ExternalWarehousePrunedSnapshot {
  return {
    dok_Id: 1,
    dok_NrPelny: "ZK",
    dok_Status: null,
    lines: lines.map((l) => ({
      key: l.key,
      tw_Symbol: null,
      tw_Nazwa: l.key,
      ob_Ilosc: l.qty,
      ob_TowId: null,
      ob_Id: null,
    })),
  };
}

describe("external-warehouse diff", () => {
  it("wykrywa added/removed/qty", () => {
    const diff = computeExternalWarehouseRefreshDiff(
      snap([
        { key: "a", qty: 1 },
        { key: "b", qty: 2 },
      ]),
      snap([
        { key: "b", qty: 5 },
        { key: "c", qty: 1 },
      ])
    );
    expect(diff.addedLineKeys).toEqual(["c"]);
    expect(diff.removedLineKeys).toEqual(["a"]);
    expect(diff.quantityChanged).toEqual([{ key: "b", from: 2, to: 5 }]);
    expect(hasExternalWarehouseRefreshDiff(diff)).toBe(true);
  });

  it("pusty diff gdy bez zmian", () => {
    const s = snap([{ key: "a", qty: 1 }]);
    expect(hasExternalWarehouseRefreshDiff(computeExternalWarehouseRefreshDiff(s, s))).toBe(
      false
    );
  });
});
