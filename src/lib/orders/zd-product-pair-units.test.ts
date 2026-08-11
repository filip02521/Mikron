import { describe, expect, it } from "vitest";
import {
  formatPairPiecesUiHint,
  formatPairSalesChannelsBreakdown,
  normalizeUnitsPerPack,
  piecesAsPackUnitsExact,
  twinTwId,
  resolvePairRole,
} from "./zd-product-pair-units";

describe("normalizeUnitsPerPack", () => {
  it("odrzuca < 2", () => {
    expect(normalizeUnitsPerPack(1)).toBeNull();
    expect(normalizeUnitsPerPack(0)).toBeNull();
    expect(normalizeUnitsPerPack(100)).toBe(100);
  });
});

describe("resolvePairRole / twin", () => {
  const pair = { packTwId: 1, pieceTwId: 2, unitsPerPack: 100 };
  it("role i twin", () => {
    expect(resolvePairRole(1, pair)).toBe("pack");
    expect(resolvePairRole(2, pair)).toBe("piece");
    expect(twinTwId(1, pair)).toBe(2);
    expect(twinTwId(2, pair)).toBe(1);
  });
});

describe("piecesAsPackUnitsExact / formatPairPiecesUiHint", () => {
  const fmt = (n: number) =>
    Number.isInteger(n)
      ? String(n)
      : n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });

  it("60 szt / 45 → ≈ 1,33 op. (nie 60 kartonów)", () => {
    expect(piecesAsPackUnitsExact(60, 45)).toBeCloseTo(60 / 45, 6);
    const hint = formatPairPiecesUiHint(60, 45, fmt);
    expect(hint.piecesLabel).toBe("60 szt");
    expect(hint.packsApproxLabel).toMatch(/≈ .* op\./);
    expect(hint.title.toLowerCase()).toContain("nie kartony");
  });

  it("bez ratio — tylko sztuki", () => {
    const hint = formatPairPiecesUiHint(60, 1, fmt);
    expect(hint.piecesLabel).toBe("60 szt");
    expect(hint.packsApproxLabel).toBeNull();
  });

  it("rozbicie kanałów: sztuki + kartony×ratio", () => {
    const b = formatPairSalesChannelsBreakdown(
      {
        pieceSprzedaz: 50,
        packSprzedaz: 2,
        unitsPerPack: 45,
        sprzedazSzt: 50 + 2 * 45,
      },
      fmt
    );
    expect(b.totalLabel).toBe("140 szt");
    expect(b.channelsLabel).toContain("50 szt");
    expect(b.channelsLabel).toContain("2 op.");
    expect(b.channelsLabel).toContain("90 szt");
  });
});
