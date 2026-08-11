import { describe, expect, it } from "vitest";
import {
  computeSalesTrackedCel,
  formatSalesTrackHint,
  ZD_SALES_TRACK,
} from "./zd-estimate-sales-track";

describe("computeSalesTrackedCel", () => {
  it("martwy SKU ze stanem < cel — passthrough", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 40,
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
      dostepne: 10,
      dniZapasu: 30,
    });
    expect(adj.applied).toBe(false);
    expect(adj.celTracked).toBe(40);
    expect(adj.deltaPieces).toBe(0);
  });

  it("martwy SKU ze stanem ≥ cel — dead_stock → cel 0", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 40,
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
      dostepne: 40,
      dniZapasu: 30,
    });
    expect(adj.applied).toBe(true);
    expect(adj.reasons).toContain("dead_stock");
    expect(adj.celTracked).toBe(0);
    expect(adj.deltaPieces).toBe(-40);
  });

  it("cover w deadbandzie + umiarkowany ST — bez korekty cover", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 30,
      sprzedazOkres: 15,
      sprzedazDziennie: 1,
      dostepne: 30,
      dniZapasu: 30,
    });
    // coverDays=30 w paśmie ±8%; sellThrough=15/45=0.333 między low i high floor
    expect(adj.reasons).not.toContain("thin_cover");
    expect(adj.reasons).not.toContain("fat_cover");
  });

  it("cienkie pokrycie — dokładamy część brakujących dni × tempo", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      dostepne: 10,
      dniZapasu: 30,
    });
    // coverDays=5 < lo, shortfall vs 30, extraDays=min(10, 25*0.4)=10, boost≥20
    expect(adj.applied).toBe(true);
    expect(adj.reasons).toContain("thin_cover");
    expect(adj.coverDays).toBeCloseTo(5);
    expect(adj.deltaPieces).toBeGreaterThan(0);
    expect(adj.celTracked).toBeGreaterThan(60);
    expect(adj.deltaPieces).toBeLessThanOrEqual(
      60 * ZD_SALES_TRACK.maxTotalBoostRatio + 1e-9
    );
  });

  it("wysoki sell-through przy cover w deadbandzie — lekki % boost", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 100,
      sprzedazOkres: 90,
      sprzedazDziennie: 1,
      dostepne: 30,
      otwarteZd: 0,
      dniZapasu: 30,
    });
    // coverDays=30 w deadbandzie; sellThrough=90/120=0.75
    expect(adj.reasons).toContain("sell_through");
    expect(adj.reasons).not.toContain("thin_cover");
    expect(adj.reasons).not.toContain("fat_cover");
    expect(adj.deltaPieces).toBeGreaterThan(0);
    expect(adj.deltaPieces).toBeLessThanOrEqual(
      100 * ZD_SALES_TRACK.sellThroughMaxBoost + 1e-6
    );
  });

  it("niski sell-through przy dostepne < cel — cut obniża cel", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 100,
      sprzedazOkres: 8,
      sprzedazDziennie: 1,
      dostepne: 50,
      dniZapasu: 30,
    });
    // coverDays=50 > hi(32.4) → fat; sellThrough=8/58≈0.14 < 0.25 → low ST
    expect(adj.deltaPieces).toBeLessThan(0);
    expect(adj.celTracked).toBeLessThan(100);
    expect(adj.celTracked).toBeGreaterThanOrEqual(
      100 * ZD_SALES_TRACK.minCelRatio - 1e-9
    );
    expect(
      adj.reasons.some((r) => r === "fat_cover" || r === "low_sell_through")
    ).toBe(true);
  });

  it("cutsEnabled:false — bez cięcia przy grubym stanie", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 100,
      sprzedazOkres: 8,
      sprzedazDziennie: 1,
      dostepne: 50,
      dniZapasu: 30,
      cutsEnabled: false,
    });
    expect(adj.deltaPieces).toBeGreaterThanOrEqual(0);
    expect(adj.reasons).not.toContain("fat_cover");
    expect(adj.reasons).not.toContain("low_sell_through");
  });

  it("enabled:false — passthrough", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      dostepne: 0,
      dniZapasu: 30,
      enabled: false,
    });
    expect(adj.applied).toBe(false);
    expect(adj.celTracked).toBe(60);
  });

  it("cel=0 + cienkie pokrycie — bez applied", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 0,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      dostepne: 0,
      dniZapasu: 30,
    });
    expect(adj.applied).toBe(false);
    expect(adj.deltaPieces).toBe(0);
    expect(adj.celTracked).toBe(0);
    expect(adj.reasons).toEqual([]);
  });

  it("brak sprzedazDziennie — tempo z okres/dniOkresu włącza thin_cover", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 60,
      sprzedazDziennie: 0,
      dostepne: 10,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.reasons).toContain("thin_cover");
    expect(adj.deltaPieces).toBeGreaterThan(0);
    expect(adj.applied).toBe(true);
  });

  it("otwarteZd wchodzi w coverStock", () => {
    const thin = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      dostepne: 10,
      otwarteZd: 0,
      dniZapasu: 30,
    });
    const withZd = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      dostepne: 10,
      otwarteZd: 50,
      dniZapasu: 30,
    });
    // 10+50=60 → coverDays=30 w deadbandzie → mniej/zero thin vs coverDays=5
    expect(withZd.coverDays).toBeCloseTo(30);
    expect(thin.deltaPieces).toBeGreaterThan(withZd.deltaPieces);
  });

  it("reasons zawiera boost i cut gdy oba sygnały (np. thin + niski ST)", () => {
    // coverDays=10/2=5 < lo → thin_cover; ST=8/(8+10)=0.44… wait need ST < 0.25
    // coverStock=10, tempo=2 → thin; sprzedaz=2 → ST=2/12≈0.167 < 0.25 → low ST
    const adj = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 2,
      sprzedazDziennie: 2,
      dostepne: 10,
      dniZapasu: 30,
    });
    expect(adj.reasons).toContain("thin_cover");
    expect(adj.reasons).toContain("low_sell_through");
  });
});

describe("formatSalesTrackHint", () => {
  it("null gdy brak korekty", () => {
    expect(
      formatSalesTrackHint({ applied: false, deltaPieces: 0, reasons: [] })
    ).toBeNull();
  });

  it("opisuje boost", () => {
    const hint = formatSalesTrackHint({
      applied: true,
      deltaPieces: 12.4,
      reasons: ["thin_cover", "sell_through"],
    });
    expect(hint).toContain("+12");
    expect(hint).toContain("cienkie pokrycie");
    expect(hint).toContain("wysoka sprzedaż");
  });

  it("opisuje cut", () => {
    const hint = formatSalesTrackHint({
      applied: true,
      deltaPieces: -8.2,
      reasons: ["low_sell_through"],
    });
    expect(hint).toContain("-8");
    expect(hint).toContain("niska sprzedaż");
  });

  it("wymienia boost i cut w jednym hicie", () => {
    const hint = formatSalesTrackHint({
      applied: true,
      deltaPieces: 3,
      reasons: ["thin_cover", "low_sell_through"],
    });
    expect(hint).toContain("cienkie pokrycie");
    expect(hint).toContain("niska sprzedaż");
  });
});
