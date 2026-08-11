import { describe, expect, it } from "vitest";
import { indexZdProductPairs } from "@/lib/orders/zd-product-pair-units";
import {
  applyPairAwareStockMap,
  expandTwIdsWithPairTwins,
  pairAwareStockSnapshotForTwId,
} from "@/lib/orders/zd-product-pair-stock";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

const pair = { packTwId: 100, pieceTwId: 200, unitsPerPack: 100 };
const pairs = indexZdProductPairs([pair]);

function snap(
  available: number,
  onHand = available,
  reserved = 0
): ProsbaLineStockSnapshot {
  return { onHand, reserved, available, source: "subiekt" };
}

describe("pair-aware stock", () => {
  it("B1/B10: piece=0, pack=5 → available 500 szt na piece SKU", () => {
    const stock = {
      200: snap(0),
      100: snap(5),
    };
    const piece = pairAwareStockSnapshotForTwId(200, stock, pairs);
    expect(piece?.available).toBe(500);
    expect(piece?.pairAware).toBe(true);
    expect(piece?.pairUnitsPerPack).toBe(100);
    const pack = pairAwareStockSnapshotForTwId(100, stock, pairs);
    expect(pack?.available).toBe(5);
  });

  it("B9: zachowuje rezerwacje w agregacie (nie zeruje reserved)", () => {
    const stock = {
      200: snap(2, 10, 8), // available 2, reserved 8
      100: snap(1, 1, 0),
    };
    const piece = pairAwareStockSnapshotForTwId(200, stock, pairs)!;
    expect(piece.available).toBe(2 + 100);
    expect(piece.reserved).toBe(8);
    expect(piece.onHand).toBe(10 + 100);
  });

  it("expandTwIds dociąga twin", () => {
    expect(expandTwIdsWithPairTwins([200], pairs).sort()).toEqual([100, 200]);
  });

  it("applyPairAwareStockMap nadpisuje obie karty", () => {
    const out = applyPairAwareStockMap(
      { 200: snap(0), 100: snap(5) },
      pairs
    );
    expect(out[200]?.available).toBe(500);
    expect(out[200]?.pairAware).toBe(true);
    expect(out[100]?.available).toBe(5);
  });
});
