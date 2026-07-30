import { describe, expect, it } from "vitest";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  hashExternalWarehouseLines,
  isExternalWarehouseShippingCostLine,
  lineDtosFromPrunedSnapshot,
  orphanLineDtosFromMeta,
  pruneSubiektZkSnapshot,
} from "./lines";

function doc(lines: SubiektDocument["dok_Pozycja"]): SubiektDocument {
  return {
    dok_Id: 42,
    dok_NrPelny: "ZK 1/M/01/2026",
    dok_Pozycja: lines,
  };
}

describe("external-warehouse lines", () => {
  it("odfiltrowuje koszty pakowania / dostawy", () => {
    expect(
      isExternalWarehouseShippingCostLine({
        tw_Symbol: "KOSZTY/PACZKA",
        tw_Nazwa: "Pakowanie",
      })
    ).toBe(true);
    expect(
      isExternalWarehouseShippingCostLine({
        tw_Symbol: "ABC",
        tw_Nazwa: "Towar",
        ob_Id: 1,
        ob_Ilosc: 2,
      })
    ).toBe(false);
  });

  it("prune zostawia tylko key/symbol/nazwa/qty", () => {
    const pruned = pruneSubiektZkSnapshot(
      doc([
        {
          ob_Id: 10,
          tw_Symbol: "SYM",
          tw_Nazwa: "Produkt",
          ob_Ilosc: 3,
          ob_CenaNetto: 99,
        },
        {
          tw_Symbol: "KOSZTY/X",
          tw_Nazwa: "Koszty dostawy",
          ob_Ilosc: 1,
        },
      ])
    );
    expect(pruned.lines).toHaveLength(1);
    expect(pruned.lines[0]).toMatchObject({
      key: "ob:10",
      tw_Symbol: "SYM",
      tw_Nazwa: "Produkt",
      ob_Ilosc: 3,
    });
    expect(pruned.lines[0]).not.toHaveProperty("ob_CenaNetto");
  });

  it("hash zależy od key+qty", () => {
    const a = hashExternalWarehouseLines([
      { key: "ob:1", ob_Ilosc: 2 },
      { key: "ob:2", ob_Ilosc: 1 },
    ]);
    const b = hashExternalWarehouseLines([
      { key: "ob:2", ob_Ilosc: 1 },
      { key: "ob:1", ob_Ilosc: 2 },
    ]);
    const c = hashExternalWarehouseLines([
      { key: "ob:1", ob_Ilosc: 3 },
      { key: "ob:2", ob_Ilosc: 1 },
    ]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("DTO linii bez raw snapshot — orphan z meta", () => {
    const pruned = pruneSubiektZkSnapshot(
      doc([{ ob_Id: 1, tw_Nazwa: "A", ob_Ilosc: 1 }])
    );
    const dtos = lineDtosFromPrunedSnapshot(
      pruned,
      new Map([["ob:1", { pallet_label: "P1", note: "n" }]])
    );
    expect(dtos[0]).toMatchObject({
      key: "ob:1",
      rowKey: "ob:1",
      product: "A",
      palletLabel: "P1",
      note: "n",
      isSplit: false,
    });
    const orphans = orphanLineDtosFromMeta(pruned, [
      { line_key: "ob:99", pallet_label: "X", note: null },
    ]);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.orphan).toBe(true);
  });

  it("rozbija jedną pozycję na udziały + resztę", () => {
    const pruned = pruneSubiektZkSnapshot(
      doc([{ ob_Id: 1, tw_Nazwa: "A", ob_Ilosc: 10 }])
    );
    const dtos = lineDtosFromPrunedSnapshot(
      pruned,
      new Map([["ob:1", { pallet_label: null, note: "linia" }]]),
      new Map([
        [
          "ob:1",
          [
            { id: "s1", pallet_label: "P-B", qty: 4, note: "na B" },
            { id: "s2", pallet_label: "P-A", qty: 3, note: "na A" },
          ],
        ],
      ])
    );
    expect(dtos).toHaveLength(3);
    expect(dtos.map((d) => d.palletLabel)).toEqual(["P-A", "P-B", null]);
    expect(dtos.map((d) => d.quantity)).toEqual([3, 4, 3]);
    expect(dtos.map((d) => d.note)).toEqual(["na A", "na B", "linia"]);
    expect(dtos[0]?.lineNote).toBe("linia");
    expect(dtos[0]?.isSplit).toBe(true);
    expect(dtos[2]?.isRemainder).toBe(true);
    expect(dtos[0]?.rowKey).toBe("ob:1#share:s2");
  });

  it("oznacza nadmiar gdy Σ udziałów > qty ZK", () => {
    const pruned = pruneSubiektZkSnapshot(
      doc([{ ob_Id: 1, tw_Nazwa: "A", ob_Ilosc: 5 }])
    );
    const dtos = lineDtosFromPrunedSnapshot(
      pruned,
      new Map(),
      new Map([
        [
          "ob:1",
          [
            { id: "s1", pallet_label: "A", qty: 4 },
            { id: "s2", pallet_label: "B", qty: 4 },
          ],
        ],
      ])
    );
    expect(dtos).toHaveLength(2);
    expect(dtos.every((d) => d.overAllocated)).toBe(true);
    expect(dtos.some((d) => d.isRemainder)).toBe(false);
  });
});
