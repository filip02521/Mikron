import { describe, expect, it } from "vitest";
import {
  comparePrices,
  detectPackFactor,
  detectPriceListColumns,
  marginPct,
  parsePriceListRows,
  priceHardBlock,
} from "./price-list";

// Nagłówek i wiersze jak w cenniku Ivoclar 01.10.2026.
const IVOCLAR = [
  [
    "Lp.", "Product Hierarchy", "Numer Katalogowy", "Nazwa materiału", "Cena detaliczna netto PLN", "vat",
    "Cena detaliczna brutto PLN", "Upust %", "Cena Dealer netto PLN", "Waluta", "Ważny od",
    "numer taryfy celnej", "kraj pochodzenia",
  ],
  [1, "120104010121", 604166, "MultiCore Flow Refill 10 g Light", 473, 0.08, 510.84, 0.36, 302.72, "PLN", 46296, 30064000000, "LI"],
  [2, "x", 531745, "ProBase Hot Polymer 20x500 g pink-V", 3520, 0.08, 3801.6, 0.36, 2252.8, "PLN", 46296, 0, "LI"],
  [3, "x", "", "pusty numer", 1, 0.23, 1, 0, 1, "PLN", 46296, 0, "LI"],
];

describe("cennik", () => {
  it("rozpoznaje kolumny Ivoclar i bierze ceny netto, nie brutto", () => {
    const cols = detectPriceListColumns(IVOCLAR)!;
    expect(cols).toMatchObject({ header: 0, symbol: 2, name: 3, retail: 4, vat: 5, discount: 7, purchase: 8, validFrom: 10 });
    const parsed = parsePriceListRows(IVOCLAR, cols);
    expect(parsed.validFrom).toBe("2026-10-01");
    expect(parsed.rows).toEqual([
      { row: 2, symbol: "604166", name: "MultiCore Flow Refill 10 g Light", purchase: 302.72, retail: 473, vat: 8, discount: 36 },
      { row: 3, symbol: "531745", name: "ProBase Hot Polymer 20x500 g pink-V", purchase: 2252.8, retail: 3520, vat: 8, discount: 36 },
    ]);
  });

  it("dzieli cenę kartonu na sztukę tylko gdy Subiekt nie ma wielopaku w nazwie", () => {
    expect(detectPackFactor("ProBase Hot Polymer 20x500 g pink-V", "ProBase Hot Polymer 500g.Pink V")).toEqual({ factor: 20, unclear: false });
    expect(detectPackFactor("Telio Inlay Syringe Universal 3x2.5g", "Telio Inlay Syringe Universal 3x2,5g")).toEqual({ factor: 1, unclear: false });
    expect(detectPackFactor("ProBase Cold Polymer 5x500 g", "ProBase Cold 2x500g")).toEqual({ factor: 1, unclear: true });
    expect(detectPackFactor("MultiCore Flow Refill 10 g Light", "MultiCore Flow 10g")).toEqual({ factor: 1, unclear: false });
  });

  const sub = { name: "Ips classic v neutral 20g", purchase: 42.37, retail: 66.19, vat: 8 };

  it("mała zmiana — zaznaczona do zapisu", () => {
    const c = comparePrices({ list: { name: "IPS Classic V 20g", purchase: 43.07, retail: 67.3, vat: 8 }, subiekt: sub, thresholdPct: 5 });
    expect(c).toEqual({ packFactor: 1, newPurchase: 43.07, newRetail: 67.3, flags: [], selected: true });
  });

  it("zmiana powyżej progu, inny VAT i opakowanie zostają do przejrzenia", () => {
    expect(comparePrices({ list: { name: "x", purchase: 45, retail: 67.3, vat: 8 }, subiekt: sub, thresholdPct: 5 }).flags).toEqual(["suspicious"]);
    expect(comparePrices({ list: { name: "x", purchase: 43.07, retail: 67.3, vat: 23 }, subiekt: sub, thresholdPct: 5 }).selected).toBe(false);
    const pack = comparePrices({
      list: { name: "ProBase Hot Polymer 20x500 g pink-V", purchase: 2252.8, retail: 3520, vat: 8 },
      subiekt: { name: "ProBase Hot Polymer 500g.Pink V", purchase: 110.24, retail: 172.25, vat: 8 },
      thresholdPct: 5,
    });
    expect(pack).toMatchObject({ packFactor: 20, newPurchase: 112.64, newRetail: 176, flags: ["pack"], selected: false });
  });

  it("zaokrągla po podziale i oznacza to; bez zmian nie jest zaznaczone", () => {
    const c = comparePrices({
      list: { name: "ProBase Hot Polymer 5x500 g clear", purchase: 576.64, retail: 901, vat: 8 },
      subiekt: { name: "ProBase Hot Polymer 500g Clear", purchase: 112.58, retail: 175.9, vat: 8 },
      thresholdPct: 5,
    });
    expect(c).toMatchObject({ newPurchase: 115.33, newRetail: 180.2, flags: ["pack", "rounded"] });
    const same = comparePrices({ list: { name: "x", purchase: 42.37, retail: 66.19, vat: null }, subiekt: sub, thresholdPct: 5 });
    expect(same).toMatchObject({ flags: ["unchanged"], selected: false });
  });

  it("brak starej ceny i detal poniżej zakupu wymagają przejrzenia", () => {
    const zero = comparePrices({ list: { name: "x", purchase: 10, retail: 20, vat: 8 }, subiekt: { ...sub, purchase: 0 }, thresholdPct: 5 });
    expect(zero.flags).toContain("old_zero");
    expect(zero.selected).toBe(false);
    const below = comparePrices({ list: { name: "x", purchase: 43, retail: 42, vat: 8 }, subiekt: { ...sub, retail: 41 }, thresholdPct: 5 });
    expect(below.flags).toContain("retail_below_purchase");
  });

  it("liczy marżę jak Subiekt", () => {
    expect(marginPct(42.37, 66.19)!.toFixed(2)).toBe("35.99");
    expect(marginPct(null, 66.19)).toBeNull();
    expect(marginPct(10, 0)).toBeNull();
  });

  it("marża po zmianie musi równać się upustowi z cennika", () => {
    const ok = comparePrices({ list: { name: "x", purchase: 43.07, retail: 67.3, vat: 8, discount: 36 }, subiekt: sub, thresholdPct: 5 });
    expect(ok.flags).toEqual([]);
    const off = comparePrices({ list: { name: "x", purchase: 43.07, retail: 67.3, vat: 8, discount: 30 }, subiekt: sub, thresholdPct: 5 });
    expect(off).toMatchObject({ flags: ["margin"], selected: false });
  });
});

describe("priceHardBlock", () => {
  const base = { oldPurchase: 100, oldRetail: 150, newPurchase: 105, newRetail: 157.5 };
  it("normalna zmiana przechodzi", () => {
    expect(priceHardBlock(base)).toBeNull();
    expect(priceHardBlock({ ...base, newRetail: null })).toBeNull();
  });
  it("przesunięty przecinek (×10 / ÷10) i cena ≤ 0 są blokowane", () => {
    expect(priceHardBlock({ ...base, newPurchase: 1050 })).toMatch(/kartotekowa.*10\.5×/);
    expect(priceHardBlock({ ...base, newRetail: 15 })).toMatch(/detaliczna.*do 10%/);
    expect(priceHardBlock({ ...base, newPurchase: 0 })).toMatch(/≤ 0/);
  });
  it("brak starej ceny — sprawdzamy tylko > 0", () => {
    expect(priceHardBlock({ ...base, oldPurchase: null, newPurchase: 99999 })).toBeNull();
  });
});
