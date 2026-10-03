import { describe, expect, it } from "vitest";
import {
  analyzeStockWatchItem,
  compareStockWatchAlerts,
  computeSalesVelocity,
  computeStockHealthScore,
  unitPricePerPiece,
  type StockWatchInput,
} from "@/lib/stock-watch/analysis";

function input(over: Partial<StockWatchInput> = {}): StockWatchInput {
  return {
    stockQty: 20,
    reservedQty: 0,
    availableQty: 20,
    openZdDocUnits: 0,
    openZkUnreservedQty: 0,
    sales30d: 30,
    sales60d: 60,
    bufferDays: 14,
    minStockQty: null,
    rule: "standard",
    packaging: null,
    lastZdPriceNet: null,
    salesEndDate: "2026-10-02",
    ...over,
  };
}

describe("computeSalesVelocity", () => {
  it("ważona 70% z 30 dni i 30% z 60 dni", () => {
    // v30 = 60/30 = 2, v60 = 60/60 = 1 → 0.7×2 + 0.3×1 = 1.7
    expect(computeSalesVelocity(60, 60)).toEqual({ velocityDaily: 1.7, trend: 2 });
  });

  it("zwroty (ujemna sprzedaż) nie dają ujemnej rotacji", () => {
    expect(computeSalesVelocity(-5, -5)).toEqual({ velocityDaily: 0, trend: null });
  });
});

describe("analyzeStockWatchItem", () => {
  it("dni do wyczerpania i data z rotacji", () => {
    // v = 1/dzień, 20 szt → 20 dni od 2026-10-02
    const r = analyzeStockWatchItem(input());
    expect(r.velocityDaily).toBe(1);
    expect(r.daysOfCover).toBe(20);
    expect(r.runOutDate).toBe("2026-10-22");
    expect(r.status).toBe("ok");
  });

  it("≤ 48 h zapasu = critical; 0 dostępnych = out_of_stock", () => {
    expect(analyzeStockWatchItem(input({ availableQty: 2 })).status).toBe("critical");
    expect(analyzeStockWatchItem(input({ availableQty: 0 })).status).toBe("out_of_stock");
    expect(analyzeStockWatchItem(input({ availableQty: -3 })).daysOfCover).toBe(0);
  });

  it("propozycja = bufor − (dostępne + otwarte ZD), w górę; ZK bez rezerwacji poza wzorem", () => {
    // bufor 1×14 = 14; projected = 5 + 3 = 8 → 6 (ZK 144 nie zawyża — jak w kreatorze ZD)
    const r = analyzeStockWatchItem(
      input({ availableQty: 5, openZdDocUnits: 3, openZkUnreservedQty: 144 })
    );
    expect(r.safetyStockQty).toBe(14);
    expect(r.suggestedQty).toBe(6);
    expect(r.status).toBe("warning");
  });

  it("otwarte ZD w paczkach przeliczane na sztuki", () => {
    const r = analyzeStockWatchItem(
      input({
        availableQty: 5,
        openZdDocUnits: 2,
        packaging: { unitsPerPackage: 10, documentUnitMode: "packages" },
      })
    );
    expect(r.openZdQty).toBe(20);
    expect(r.suggestedQty).toBe(0);
    expect(r.status).toBe("ok");
  });

  it("minimum stanów podnosi bufor i alarmuje bez sprzedaży", () => {
    const r = analyzeStockWatchItem(
      input({ sales30d: 0, sales60d: 0, availableQty: 1, minStockQty: 5 })
    );
    expect(r.safetyStockQty).toBe(5);
    expect(r.suggestedQty).toBe(4);
    expect(r.status).toBe("warning");
  });

  it("brak sprzedaży i brak minimum = no_sales, bez propozycji", () => {
    const r = analyzeStockWatchItem(input({ sales30d: 0, sales60d: 0, availableQty: 0 }));
    expect(r.status).toBe("no_sales");
    expect(r.suggestedQty).toBe(0);
    expect(r.daysOfCover).toBeNull();
  });

  it("„Na prośbę” i „Wykluczone” nie dostają propozycji zapasu", () => {
    expect(analyzeStockWatchItem(input({ availableQty: 0, rule: "on_request" })).suggestedQty).toBe(0);
    expect(analyzeStockWatchItem(input({ availableQty: 0, rule: "excluded" })).suggestedQty).toBe(0);
  });

  it("wartość dzienna = rotacja × cena za sztukę", () => {
    const r = analyzeStockWatchItem(
      input({
        lastZdPriceNet: 50,
        packaging: { unitsPerPackage: 5, documentUnitMode: "packages" },
      })
    );
    expect(r.unitPriceNet).toBe(10);
    expect(r.dailyValue).toBe(10);
  });
});

describe("unitPricePerPiece", () => {
  it("tryb wielokrotności sztuk: cena już za sztukę", () => {
    expect(
      unitPricePerPiece(12, { unitsPerPackage: 6, documentUnitMode: "pieces_multiple" })
    ).toBe(12);
  });

  it("brak / zerowa cena = null", () => {
    expect(unitPricePerPiece(null, null)).toBeNull();
    expect(unitPricePerPiece(0, null)).toBeNull();
  });
});

describe("compareStockWatchAlerts", () => {
  it("brak przed krytycznym, potem większa wartość dzienna", () => {
    const rows = [
      { id: "crit-low", status: "critical" as const, dailyValue: 5, velocityDaily: 1, daysOfCover: 1 },
      { id: "oos", status: "out_of_stock" as const, dailyValue: 1, velocityDaily: 1, daysOfCover: 0 },
      { id: "crit-high", status: "critical" as const, dailyValue: 50, velocityDaily: 1, daysOfCover: 2 },
    ];
    expect(rows.sort(compareStockWatchAlerts).map((r) => r.id)).toEqual([
      "oos",
      "crit-high",
      "crit-low",
    ]);
  });
});

describe("computeStockHealthScore", () => {
  it("udział OK wśród aktywnych (standard, z rotacją)", () => {
    expect(
      computeStockHealthScore([
        { status: "ok", rule: "standard" },
        { status: "warning", rule: "standard" },
        { status: "no_sales", rule: "standard" },
        { status: "out_of_stock", rule: "excluded" },
      ])
    ).toEqual({ score: 50, active: 2, ok: 1 });
  });
});
