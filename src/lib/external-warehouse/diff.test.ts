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

  it("wykrywa zmianę nazwy i podmianę towaru w tej samej pozycji", () => {
    const prev: ExternalWarehousePrunedSnapshot = {
      dok_Id: 1,
      dok_NrPelny: "ZK",
      dok_Status: 7,
      lines: [
        { key: "ob:1", tw_Symbol: "G1", tw_Nazwa: "Gips", ob_Ilosc: 5, ob_TowId: 10, ob_Id: 1 },
        { key: "ob:2", tw_Symbol: "S1", tw_Nazwa: "Silikon", ob_Ilosc: 2, ob_TowId: 20, ob_Id: 2 },
      ],
    };
    const next: ExternalWarehousePrunedSnapshot = {
      ...prev,
      lines: [
        { ...prev.lines[0]!, tw_Nazwa: "Gips 25kg" },
        { ...prev.lines[1]!, tw_Symbol: "S9", tw_Nazwa: "Silikon fast", ob_TowId: 99 },
      ],
    };
    const diff = computeExternalWarehouseRefreshDiff(prev, next);
    expect(diff.quantityChanged).toEqual([]);
    expect(diff.productChanged).toEqual([
      { key: "ob:1", from: "Gips (G1)", to: "Gips 25kg (G1)", productSwapped: false },
      { key: "ob:2", from: "Silikon (S1)", to: "Silikon fast (S9)", productSwapped: true },
    ]);
    expect(hasExternalWarehouseRefreshDiff(diff)).toBe(true);
  });

  it("pusty diff gdy bez zmian", () => {
    const s = snap([{ key: "a", qty: 1 }]);
    expect(hasExternalWarehouseRefreshDiff(computeExternalWarehouseRefreshDiff(s, s))).toBe(
      false
    );
  });
});
