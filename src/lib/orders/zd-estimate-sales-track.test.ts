import { describe, expect, it } from "vitest";
import {
  celForTargetOrderQty,
  computeBoostConfidence,
  computeSalesTrackedCel,
  formatSalesTrackHint,
  formatSalesTrackReviewBadge,
  orderQtyFromCel,
  reconcileSalesTrackQtyMetaAfterHistory,
  soldNormalizedToZapas,
  ZD_SALES_TRACK,
} from "./zd-estimate-sales-track";
import {
  computeManualOrderQty,
  mapZdEstimateLineToManual,
} from "./zd-estimate-manual";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";

describe("soldNormalizedToZapas / confidence helpers", () => {
  it("normalizuje sprzedaż do horyzontu Zapasu", () => {
    expect(
      soldNormalizedToZapas({
        sprzedazOkres: 3,
        dniOkresuEffective: 90,
        dniZapasu: 30,
      })
    ).toBe(1);
  });

  it("demandStrength 0 przy soldInZapas≤1, 1 przy ≥6", () => {
    expect(
      computeBoostConfidence({
        sprzedazOkres: 1,
        dniOkresuEffective: 30,
        dniZapasu: 30,
        coverStock: 0,
      })
    ).toBe(0);
    expect(
      computeBoostConfidence({
        sprzedazOkres: 6,
        dniOkresuEffective: 30,
        dniZapasu: 30,
        coverStock: 0,
      })
    ).toBe(1);
  });

  it("celForTargetOrderQty: delta = allowed przy cover ułamkowym", () => {
    const cel = celForTargetOrderQty({
      celBase: 1,
      coverStock: 0.4,
      targetOrderQty: 2,
    });
    expect(orderQtyFromCel(cel, 0.4)).toBe(2);
    expect(cel - 1).toBeCloseTo(1, 9);
  });
});

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
    expect(adj.qtyReview).toBe(false);
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
    expect(adj.applied).toBe(true);
    expect(adj.reasons).toContain("thin_cover");
    expect(adj.coverDays).toBeCloseTo(5);
    expect(adj.deltaPieces).toBeGreaterThan(0);
    expect(adj.celTracked).toBeGreaterThan(60);
    expect(adj.deltaPieces).toBeLessThanOrEqual(
      60 * ZD_SALES_TRACK.maxTotalBoostRatio + 1e-9
    );
    expect(adj.confidence).toBeGreaterThanOrEqual(
      ZD_SALES_TRACK.boostQtyConfidenceMin
    );
    expect(adj.reasons).not.toContain("boost_held");
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
    expect(adj.deltaPieces).toBeLessThan(0);
    expect(adj.celTracked).toBeLessThan(100);
    expect(adj.celTracked).toBeGreaterThanOrEqual(
      100 * ZD_SALES_TRACK.minCelRatio - 1e-9
    );
    expect(
      adj.reasons.some((r) => r === "fat_cover" || r === "low_sell_through")
    ).toBe(true);
    expect(adj.reasons).not.toContain("boost_held");
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
    expect(withZd.coverDays).toBeCloseTo(30);
    expect(thin.deltaPieces).toBeGreaterThan(withZd.deltaPieces);
  });

  it("reasons zawiera boost i cut gdy oba sygnały (np. thin + niski ST)", () => {
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

  it("hold przy boost+cut — cięcie zostaje (nie wraca do celBase)", () => {
    const cover = 50;
    const adj = computeSalesTrackedCel({
      celZapasu: 100,
      sprzedazOkres: 3,
      sprzedazDziennie: 3,
      dostepne: cover,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.reasons).toContain("thin_cover");
    expect(adj.reasons).toContain("low_sell_through");
    expect(adj.reasons).toContain("boost_held");
    expect(adj.confidence).toBeLessThan(ZD_SALES_TRACK.boostQtyConfidenceMin);
    expect(adj.celTracked).toBeLessThan(100);
    expect(adj.deltaPieces).toBeLessThan(0);
    expect(adj.allowedExtraQty).toBe(0);
    expect(adj.heldExtraQty).toBeGreaterThan(0);
    const qty = orderQtyFromCel(adj.celTracked, cover);
    const qtyBase = orderQtyFromCel(100, cover);
    expect(qty).toBeLessThan(qtyBase);
  });

  it("sold=1 cover=0 zapas=30 — boost_held, Do ZD 1", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 1,
      sprzedazOkres: 1,
      sprzedazDziennie: 1 / 30,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.confidence).toBe(0);
    expect(adj.reasons).toContain("boost_held");
    expect(adj.qtyReview).toBe(true);
    expect(adj.allowedExtraQty).toBe(0);
    expect(adj.heldExtraQty).toBeGreaterThan(0);
    expect(adj.deltaPieces).toBe(0);
    expect(orderQtyFromCel(adj.celTracked, 0)).toBe(1);
  });

  it("sold=1 zapas=14 — hold (skalowanie Zapasu)", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 1,
      sprzedazOkres: 1,
      sprzedazDziennie: 1 / 14,
      dostepne: 0,
      dniZapasu: 14,
      dniOkresu: 14,
    });
    expect(adj.reasons).toContain("boost_held");
    expect(orderQtyFromCel(adj.celTracked, 0)).toBe(1);
  });

  it("sold=3 cover=0 — hold (conf<min)", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 3,
      sprzedazOkres: 3,
      sprzedazDziennie: 0.1,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.confidence).toBeLessThan(ZD_SALES_TRACK.boostQtyConfidenceMin);
    expect(adj.reasons).toContain("boost_held");
    expect(orderQtyFromCel(adj.celTracked, 0)).toBe(3);
  });

  it("sold=4 cover=0 — partial allow (boost_scaled), delta=allowed", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 4,
      sprzedazOkres: 4,
      sprzedazDziennie: 4 / 30,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.confidence).toBeGreaterThanOrEqual(
      ZD_SALES_TRACK.boostQtyConfidenceMin
    );
    expect(adj.confidence).toBeLessThan(1);
    expect(adj.reasons).toContain("boost_scaled");
    expect(adj.allowedExtraQty).toBe(1);
    expect(adj.deltaPieces).toBe(1);
    expect(orderQtyFromCel(adj.celTracked, 0)).toBe(5);
  });

  it("sold=15 cover=0 — full scale, nie tylko +1", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 15,
      sprzedazOkres: 15,
      sprzedazDziennie: 0.5,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.confidence).toBe(1);
    expect(adj.reasons).not.toContain("boost_held");
    expect(adj.reasons).not.toContain("boost_scaled");
    const qty = orderQtyFromCel(adj.celTracked, 0);
    expect(qty).toBeGreaterThan(16);
    expect(qty).toBe(
      orderQtyFromCel(15 * (1 + ZD_SALES_TRACK.maxTotalBoostRatio), 0)
    );
    expect(adj.deltaPieces).toBe(adj.allowedExtraQty);
  });

  it("sold=100 cover=0 — full scale setki", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 100,
      sprzedazOkres: 100,
      sprzedazDziennie: 100 / 30,
      dostepne: 0,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.confidence).toBe(1);
    expect(orderQtyFromCel(adj.celTracked, 0)).toBe(135);
    expect(adj.allowedExtraQty).toBe(35);
    expect(adj.deltaPieces).toBe(35);
  });

  it("cover=1 cel=1 ST boost — hold, Do ZD 0", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 1,
      sprzedazOkres: 1,
      sprzedazDziennie: 1 / 30,
      dostepne: 1,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.reasons).toContain("boost_held");
    expect(orderQtyFromCel(adj.celTracked, 1)).toBe(0);
  });

  it("ułamkowy boost bez wzrostu Do ZD — cel bez phantom +delta", () => {
    const adj = computeSalesTrackedCel({
      celZapasu: 1,
      sprzedazOkres: 1,
      sprzedazDziennie: 1 / 30,
      dostepne: 0.4,
      dniZapasu: 30,
      dniOkresu: 30,
    });
    expect(adj.reasons).not.toContain("boost_held");
    expect(adj.deltaPieces).toBe(0);
    expect(adj.celTracked).toBe(1);
    expect(orderQtyFromCel(adj.celTracked, 0.4)).toBe(1);
  });

  it("niezmiennik: Do ZD = qtyBase + allowedExtra (brak cut) dla wielu wolumenów", () => {
    for (const sold of [1, 2, 3, 4, 6, 10, 15, 50, 100, 200]) {
      const adj = computeSalesTrackedCel({
        celZapasu: sold,
        sprzedazOkres: sold,
        sprzedazDziennie: sold / 30,
        dostepne: 0,
        dniZapasu: 30,
        dniOkresu: 30,
      });
      const qtyBase = orderQtyFromCel(sold, 0);
      const qty = orderQtyFromCel(adj.celTracked, 0);
      expect(qty).toBe(qtyBase + adj.allowedExtraQty);
      if (adj.reasons.includes("boost_held")) {
        expect(adj.allowedExtraQty).toBe(0);
        expect(qty).toBe(qtyBase);
      }
    }
  });

  it("niezmiennik: cover ułamkowy — qty = ceil(celBase-cover) + allowed", () => {
    for (const cover of [0.1, 0.4, 0.9, 1.5, 3.2]) {
      for (const sold of [1, 4, 10, 40]) {
        const adj = computeSalesTrackedCel({
          celZapasu: sold,
          sprzedazOkres: sold,
          sprzedazDziennie: sold / 30,
          dostepne: cover,
          dniZapasu: 30,
          dniOkresu: 30,
        });
        if (adj.reasons.some((r) => r === "fat_cover" || r === "low_sell_through")) {
          continue;
        }
        const qtyBase = orderQtyFromCel(sold, cover);
        const qty = orderQtyFromCel(adj.celTracked, cover);
        expect(qty).toBe(qtyBase + adj.allowedExtraQty);
      }
    }
  });
});

describe("reconcileSalesTrackQtyMetaAfterHistory", () => {
  it("czyści boost_held i held po history cut", () => {
    const r = reconcileSalesTrackQtyMetaAfterHistory({
      celBase: 10,
      celTracked: 8,
      coverStock: 0,
      confidence: 0.2,
      reasons: ["thin_cover", "boost_held", "history_slow"],
    });
    expect(r.salesTrackReasons).toEqual(["thin_cover", "history_slow"]);
    expect(r.salesTrackHeldExtraQty).toBe(0);
    expect(r.salesTrackAllowedExtraQty).toBe(0);
    expect(r.salesTrackQtyReview).toBe(false);
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

  it("boost_held przy delta≈0", () => {
    const hint = formatSalesTrackHint({
      applied: false,
      deltaPieces: 0,
      reasons: ["thin_cover", "boost_held"],
      confidence: 0,
      qtyReview: true,
      heldExtraQty: 1,
      allowedExtraQty: 0,
    });
    expect(hint).toMatch(/bez \+1 szt/);
    expect(hint).toMatch(/niska pewność 0%/);
  });

  it("boost_held + cut (delta<0) — pokazuje cut i wstrzymany boost", () => {
    const hint = formatSalesTrackHint({
      applied: true,
      deltaPieces: -9.3,
      reasons: ["thin_cover", "low_sell_through", "boost_held"],
      confidence: 0.2,
      qtyReview: true,
      heldExtraQty: 7,
      allowedExtraQty: 0,
    });
    expect(hint).toMatch(/-9\.3|-9/);
    expect(hint).toContain("niska sprzedaż");
    expect(hint).toMatch(/bez \+7 boost/);
  });

  it("boost_scaled", () => {
    const hint = formatSalesTrackHint({
      applied: true,
      deltaPieces: 1,
      reasons: ["thin_cover", "boost_scaled"],
      confidence: 0.6,
      qtyReview: true,
      heldExtraQty: 1,
      allowedExtraQty: 1,
    });
    expect(hint).toMatch(/\+1 szt z \+2/);
  });
});

describe("formatSalesTrackReviewBadge", () => {
  it("null gdy nie ma qtyReview", () => {
    expect(
      formatSalesTrackReviewBadge({
        qtyReview: false,
        confidence: 0.4,
        reasons: ["thin_cover"],
      })
    ).toBeNull();
  });

  it("pewność + główny powód, bez boost_held", () => {
    expect(
      formatSalesTrackReviewBadge({
        qtyReview: true,
        confidence: 0.42,
        reasons: ["boost_held", "thin_cover"],
      })
    ).toEqual({
      confidencePct: 42,
      reason: "cienkie pokrycie",
      label: "42% · cienkie pokrycie",
    });
  });
});

describe("mapZdEstimateLineToManual confidence hold", () => {
  function subLine(
    overrides: Partial<SubiektZdEstimateLine>
  ): SubiektZdEstimateLine {
    return {
      tw_Id: 1,
      tw_Symbol: "X",
      tw_Nazwa: "X",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 1,
      sprzedazDziennie: 1 / 30,
      celZapasu: 1,
      otwarteZd: 0,
      otwarteZkBezRez: 0,
      otwarteZkZarezerwowane: 0,
      doZamowienia: 1,
      ...overrides,
    };
  }

  it("sold=1 → doZamowieniaReczne 1 + boost_held", () => {
    const m = mapZdEstimateLineToManual(subLine({}), {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
    });
    expect(m.doZamowieniaReczne).toBe(1);
    expect(m.salesTrackReasons).toContain("boost_held");
    expect(m.salesTrackQtyReview).toBe(true);
    expect(m.salesTrackConfidence).toBe(0);
  });

  it("computeManualOrderQty zgodne z orderQtyFromCel", () => {
    expect(
      computeManualOrderQty({ celZapasu: 1.35, dostepne: 0, otwarteZd: 0 })
    ).toBe(orderQtyFromCel(1.35, 0));
  });
});
