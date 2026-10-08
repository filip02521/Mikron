import { describe, expect, it } from "vitest";
import {
  analyzeStockWatchItem,
  compareStockWatchAlerts,
  computeStockHealthScore,
  pairStockPieces,
  unitPricePerPiece,
  type StockWatchInput,
} from "@/lib/stock-watch/analysis";

function input(over: Partial<StockWatchInput> = {}): StockWatchInput {
  return {
    availableQty: 20,
    openZdQty: 0,
    velocityDaily: 1,
    targetQty: 14,
    minStockQty: null,
    unitPriceNet: null,
    salesEndDate: "2026-10-02",
    ...over,
  };
}

describe("analyzeStockWatchItem", () => {
  it("dni do wyczerpania i data z rotacji", () => {
    // v = 1/dzień, 20 szt → 20 dni od 2026-10-02
    const r = analyzeStockWatchItem(input());
    expect(r.daysOfCover).toBe(20);
    expect(r.runOutDate).toBe("2026-10-22");
    expect(r.status).toBe("ok");
  });

  it("≤ 48 h zapasu = critical; 0 dostępnych = out_of_stock", () => {
    expect(analyzeStockWatchItem(input({ availableQty: 2 })).status).toBe("critical");
    expect(analyzeStockWatchItem(input({ availableQty: 0 })).status).toBe("out_of_stock");
    expect(analyzeStockWatchItem(input({ availableQty: -3 })).daysOfCover).toBe(0);
  });

  it("warning gdy dostępne + otwarte ZD < cel z Kreatora", () => {
    expect(analyzeStockWatchItem(input({ availableQty: 5, openZdQty: 3 })).status).toBe("warning");
    expect(analyzeStockWatchItem(input({ availableQty: 5, openZdQty: 9 })).status).toBe("ok");
  });

  it("minimum stanów podnosi cel i alarmuje bez sprzedaży", () => {
    const r = analyzeStockWatchItem(
      input({ velocityDaily: 0, targetQty: 0, availableQty: 1, minStockQty: 5 })
    );
    expect(r.status).toBe("warning");
    expect(r.daysOfCover).toBeNull();
  });

  it("brak sprzedaży i brak minimum = no_sales", () => {
    const r = analyzeStockWatchItem(input({ velocityDaily: 0, availableQty: 0 }));
    expect(r.status).toBe("no_sales");
    expect(r.daysOfCover).toBeNull();
  });

  it("wartość dzienna = rotacja × cena za sztukę", () => {
    expect(analyzeStockWatchItem(input({ velocityDaily: 2, unitPriceNet: 10 })).dailyValue).toBe(20);
  });
});

describe("unitPricePerPiece", () => {
  it("cena ZD za paczkę dzielona przez sztuki w opakowaniu", () => {
    expect(unitPricePerPiece(50, { unitsPerPackage: 5, documentUnitMode: "packages" })).toBe(10);
  });

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

describe("pairStockPieces", () => {
  const wirofine = {
    role: "pack" as const,
    unitsPerPack: 45,
    pieceDostepne: 240,
    packDostepne: 5,
    coverSzt: 240 + 5 * 45 + 2 * 45, // + 2 kartony na otwartym ZD
  };

  it("paczka: stan w sztukach = sztuki + paczki × przelicznik, ZD = reszta pokrycia", () => {
    expect(pairStockPieces(wirofine)).toEqual({ availableQty: 465, openZdQty: 90 });
  });

  it("Wirofine nie jest krytyczny (dawniej 5 kartonów / 8 szt. dziennie = 0,6 dnia)", () => {
    const stock = pairStockPieces(wirofine)!;
    const r = analyzeStockWatchItem(input({ ...stock, velocityDaily: 7.97, targetQty: 175 }));
    expect(r.status).toBe("ok");
    expect(r.daysOfCover).toBe(58.3);
  });

  it("linia sztuk, brak pary albo brak partnera → zwykłe liczenie", () => {
    expect(pairStockPieces({ ...wirofine, role: "piece" })).toBeNull();
    expect(pairStockPieces({ ...wirofine, partnerMissing: true })).toBeNull();
    expect(pairStockPieces(null)).toBeNull();
  });
});
