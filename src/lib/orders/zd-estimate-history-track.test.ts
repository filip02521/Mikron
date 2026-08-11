import { describe, expect, it } from "vitest";
import {
  applyHistorySlowCut,
  applySalesSpikeCut,
  applyZdEstimateHistoryCuts,
  estimateSoldSinceLink,
  expectedSalesFromLastOrder,
  ZD_HISTORY_TRACK,
  ZD_SALES_SPIKE_TRACK,
} from "./zd-estimate-history-track";

const NOW_MS = Date.parse("2026-08-07T12:00:00.000Z");
const LINKED_14D = new Date(NOW_MS - 14 * 24 * 60 * 60 * 1000).toISOString();

describe("estimateSoldSinceLink", () => {
  it("tempo × dni, ograniczone oknem FS", () => {
    expect(
      estimateSoldSinceLink({
        sprzedazOkres: 90,
        sprzedazDziennie: 1,
        daysSinceLink: 14,
      })
    ).toBe(14);
    expect(
      estimateSoldSinceLink({
        sprzedazOkres: 10,
        sprzedazDziennie: 1,
        daysSinceLink: 14,
      })
    ).toBe(10);
  });

  it("bez tempa → cały sprzedazOkres (górny limit)", () => {
    expect(
      estimateSoldSinceLink({
        sprzedazOkres: 40,
        sprzedazDziennie: 0,
        daysSinceLink: 14,
      })
    ).toBe(40);
  });

  it("0 dni od linku → 0", () => {
    expect(
      estimateSoldSinceLink({
        sprzedazOkres: 40,
        sprzedazDziennie: 2,
        daysSinceLink: 0,
      })
    ).toBe(0);
  });
});

describe("expectedSalesFromLastOrder", () => {
  it("skaluje lastOrderedQty do długości okna FS", () => {
    expect(
      expectedSalesFromLastOrder({
        lastOrderedQty: 100,
        dniZapasu: 30,
        dniOkresu: 30,
      })
    ).toBe(100);
    expect(
      expectedSalesFromLastOrder({
        lastOrderedQty: 100,
        dniZapasu: 30,
        dniOkresu: 60,
      })
    ).toBe(200);
  });
});

describe("applySalesSpikeCut", () => {
  it("normalna sprzedaż ≈ last order — bez cut", () => {
    const adj = applySalesSpikeCut({
      celTracked: 100,
      celBase: 100,
      sprzedazOkres: 110,
      sprzedazDziennie: 110 / 30,
      coverStock: 20,
      dniZapasu: 30,
      dniOkresu: 30,
      lastOrderedQty: 100,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(adj.reason).toBeNull();
  });

  it("skok 3× względem ostatniego ZD — obniża cel", () => {
    // expected = 100; sprzedaz = 300 → ratio 3 ≥ 1.75
    const adj = applySalesSpikeCut({
      celTracked: 300,
      celBase: 300,
      sprzedazOkres: 300,
      sprzedazDziennie: 10,
      coverStock: 10,
      dniZapasu: 30,
      dniOkresu: 30,
      lastOrderedQty: 100,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(adj.reason).toBe("sales_spike");
    expect(adj.spikeRatio).toBeCloseTo(3, 5);
    expect(adj.celTracked).toBeLessThan(300);
    expect(adj.celTracked).toBeGreaterThanOrEqual(
      300 * ZD_SALES_SPIKE_TRACK.minCelRatio
    );
    expect(adj.deltaPieces).toBeLessThan(0);
  });

  it("max cut ratio względem celBase", () => {
    const adj = applySalesSpikeCut({
      celTracked: 500,
      celBase: 500,
      sprzedazOkres: 1000,
      sprzedazDziennie: 30,
      coverStock: 0,
      dniZapasu: 30,
      dniOkresu: 30,
      lastOrderedQty: 100,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(adj.reason).toBe("sales_spike");
    expect(500 - adj.celTracked).toBeLessThanOrEqual(
      500 * ZD_SALES_SPIKE_TRACK.maxCutRatio + 1e-9
    );
  });
});

describe("applyZdEstimateHistoryCuts", () => {
  it("spike przed history_slow", () => {
    const out = applyZdEstimateHistoryCuts({
      celTracked: 300,
      celBase: 300,
      sprzedazOkres: 300,
      sprzedazDziennie: 10,
      coverStock: 50,
      dniZapasu: 30,
      dniOkresu: 30,
      lastOrderedQty: 100,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(out.reasons).toContain("sales_spike");
    expect(out.celTracked).toBeLessThan(300);
  });
});

describe("applyHistorySlowCut", () => {
  it("bez historii / za wcześnie — bez cut", () => {
    const recent = new Date(NOW_MS - 2 * 24 * 60 * 60 * 1000).toISOString();
    const adj = applyHistorySlowCut({
      celTracked: 80,
      celBase: 100,
      sprzedazOkres: 5,
      sprzedazDziennie: 1,
      coverStock: 40,
      dniZapasu: 30,
      lastOrderedQty: 50,
      linkedAt: recent,
      nowMs: NOW_MS,
    });
    expect(adj.reason).toBeNull();
    expect(adj.deltaPieces).toBe(0);
  });

  it("wolna sprzedaż vs zamówione — obniża cel", () => {
    const adj = applyHistorySlowCut({
      celTracked: 100,
      celBase: 100,
      sprzedazOkres: 10,
      sprzedazDziennie: 1,
      coverStock: 40,
      dniZapasu: 30,
      lastOrderedQty: 50,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    // soldSinceLink=min(10,14)=10 → 10/50=0.2 < 0.4; coverDays=40 > 30*0.92
    expect(adj.reason).toBe("history_slow");
    expect(adj.soldSinceLink).toBe(10);
    expect(adj.daysSinceLink).toBe(14);
    expect(adj.celTracked).toBeLessThan(100);
    expect(adj.celTracked).toBeGreaterThanOrEqual(50);
    expect(adj.deltaPieces).toBeLessThan(0);
  });

  it("duże okno FS nie maskuje wolnej sprzedaży od linked_at", () => {
    // Bez sold-since-link: 90/50=1.8 → brak cut; z limitem tempo×dni: 14/50=0.28 → cut.
    const adj = applyHistorySlowCut({
      celTracked: 100,
      celBase: 100,
      sprzedazOkres: 90,
      sprzedazDziennie: 1,
      coverStock: 50,
      dniZapasu: 30,
      lastOrderedQty: 50,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(adj.soldSinceLink).toBe(14);
    expect(adj.reason).toBe("history_slow");
  });

  it("cienki stan — nie tnie (nie zagładzać)", () => {
    const adj = applyHistorySlowCut({
      celTracked: 100,
      celBase: 100,
      sprzedazOkres: 5,
      sprzedazDziennie: 2,
      coverStock: 10,
      dniZapasu: 30,
      lastOrderedQty: 50,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    // coverDays=5 < 27.6
    expect(adj.reason).toBeNull();
  });

  it("max cut ratio respektowany względem celBase", () => {
    const adj = applyHistorySlowCut({
      celTracked: 100,
      celBase: 100,
      sprzedazOkres: 0,
      sprzedazDziennie: 1,
      coverStock: 50,
      dniZapasu: 30,
      lastOrderedQty: 100,
      linkedAt: LINKED_14D,
      nowMs: NOW_MS,
    });
    expect(adj.reason).toBe("history_slow");
    expect(100 - adj.celTracked).toBeLessThanOrEqual(
      100 * ZD_HISTORY_TRACK.maxCutRatio + 1e-9
    );
  });
});
