import { describe, expect, it } from "vitest";
import {
  comparePrices,
  detectPackFactor,
  detectPriceListColumns,
  foreignCurrency,
  isWithdrawnName,
  baseSymbol,
  marginPct,
  parsePriceListRows,
  pieceFactor,
  priceBackupCsv,
  priceListProfile,
  profileColumns,
  priceHardBlock,
  stillAsPreviewed,
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
      { row: 2, symbol: "604166", name: "MultiCore Flow Refill 10 g Light", purchase: 302.72, retail: 473, vat: 8, discount: 36, missingPurchase: false, missingRetail: false },
      { row: 3, symbol: "531745", name: "ProBase Hot Polymer 20x500 g pink-V", purchase: 2252.8, retail: 3520, vat: 8, discount: 36, missingPurchase: false, missingRetail: false },
    ]);
    expect(cols.currency).toBe(9);
    expect(foreignCurrency(IVOCLAR, cols)).toBeNull();
  });

  it("cennik w obcej walucie jest odrzucany (nagłówek albo kolumna Waluta)", () => {
    const eurHeader = [["Nr kat", "Cena Dealer netto EUR"], ["1", 10]];
    expect(foreignCurrency(eurHeader, detectPriceListColumns(eurHeader)!)).toBe("EUR");
    const eurColumn = IVOCLAR.map((r, i) => (i === 2 ? r.map((c, j) => (j === 9 ? "EUR" : c)) : r));
    expect(foreignCurrency(eurColumn, detectPriceListColumns(eurColumn)!)).toBe("EUR");
  });

  it("pusta cena w kolumnie, która jest w pliku, nie przechodzi po cichu", () => {
    const rows = [IVOCLAR[0]!, [1, "x", 604166, "MultiCore", 473, 0.08, 510.84, 0.36, "", "PLN", 46296, 0, "LI"]];
    const row = parsePriceListRows(rows, detectPriceListColumns(rows)!).rows[0]!;
    expect(row).toMatchObject({ purchase: null, missingPurchase: true, missingRetail: false });
    const c = comparePrices({ list: row, subiekt: { name: "MultiCore", purchase: 300, retail: 470, vat: 8 }, thresholdPct: 5 });
    expect(c).toMatchObject({ selected: false });
    expect(c.flags).toContain("list_incomplete");
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

describe("karty sztuk z opakowań", () => {
  it("kod bazowy z doklejonym opisem", () => {
    expect(baseSymbol("761302 1SZT.")).toBe("761302");
    expect(baseSymbol("685586 / 100G")).toBe("685586");
    expect(baseSymbol("626320/1 SZT")).toBe("626320");
    expect(baseSymbol("761302")).toBeNull();
    expect(baseSymbol("P310 + VP3")).toBeNull();
  });
  it("liczba sztuk z nazwy karty opakowania w Subiekcie", () => {
    expect(pieceFactor("OptraGloss Extra Oral płomień granatowy 5 szt.", "OptraGloss Extra Oral płomień granatowy 1 szt.")).toBe(5);
    expect(pieceFactor("IPS PressVEST Premium Powder 5kg (50x100g)", "IPS PressVEST Premium Powder 100g")).toBe(50);
    expect(pieceFactor("Ips E.Max Press HT A1 5szt.", "IPS e.max Press 1szt (różne rodzaje)")).toBe(5);
    expect(pieceFactor("IPS Ivocolor Shade 5g", "IPS Ivocolor Shade 1g")).toBeNull();
  });
  it("cena sztuki = cena opakowania ÷ N, zawsze do decyzji", () => {
    const c = comparePrices({
      list: { name: "OptraGloss Extra Oral Flame PP", purchase: 191.68, retail: 299.5, vat: 8 },
      subiekt: { name: "OptraGloss … 1 szt.", purchase: 36.74, retail: 56.91, vat: 8 },
      thresholdPct: 5,
      pieceFactor: 5,
    });
    expect(c).toMatchObject({ packFactor: 5, newPurchase: 38.34, newRetail: 59.9, selected: false });
    expect(c.flags).toContain("piece");
  });
  it("zatwierdzenie mimo blokady zdejmuje tylko blokadę skali", () => {
    const item = { oldPurchase: 12.42, oldRetail: 136.62, newPurchase: 12.42, newRetail: 21.05 };
    expect(priceHardBlock(item)).not.toBeNull();
    expect(priceHardBlock({ ...item, flags: ["override"] })).toBeNull();
    expect(priceHardBlock({ ...item, newRetail: 0, flags: ["override"] })).toMatch(/≤ 0/);
  });
});

describe("ceny z 3+ miejscami", () => {
  it("12.345 z pliku czeka na decyzję (może to być 12 345 zł)", () => {
    const c = comparePrices({ list: { name: "x", purchase: 12.345, retail: 20, vat: 8 }, subiekt: { name: "x", purchase: 12.3, retail: 19.5, vat: 8 }, thresholdPct: 5 });
    expect(c.flags).toEqual(expect.arrayContaining(["rounded", "decimals"]));
    expect(c.selected).toBe(false);
  });
});

describe("stillAsPreviewed", () => {
  const old = { purchase: 42.37, retail: 66.19 };
  const target = { purchase: 43.07, retail: 67.3 };
  it("cena z podglądu albo już docelowa (przerwany zapis) — wolno zapisać", () => {
    expect(stillAsPreviewed(old, old, target)).toBe(true);
    expect(stillAsPreviewed({ purchase: 43.07, retail: 66.19 }, old, target)).toBe(true);
    expect(stillAsPreviewed(target, old, target)).toBe(true);
  });
  it("ktoś zmienił cenę po podglądzie — nie nadpisujemy", () => {
    expect(stillAsPreviewed({ purchase: 50, retail: 66.19 }, old, target)).toBe(false);
    expect(stillAsPreviewed({ purchase: 42.37, retail: null }, old, target)).toBe(false);
    expect(stillAsPreviewed({ purchase: 42.37, retail: 67.3 }, old, { purchase: 43.07, retail: null })).toBe(false);
  });
});

describe("blokady i flagi kontroli", () => {
  it("towar zablokowany w Subiekcie czeka na decyzję", () => {
    const c = comparePrices({
      list: { name: "x", purchase: 43.07, retail: 67.3, vat: 8 },
      subiekt: { name: "x", purchase: 42.37, retail: 66.19, vat: 8, blocked: true },
      thresholdPct: 5,
    });
    expect(c).toMatchObject({ flags: ["blocked"], selected: false });
  });
  it("błąd odczytu przy podglądzie blokuje zapis", () => {
    expect(priceHardBlock({ oldPurchase: null, oldRetail: null, newPurchase: 1, newRetail: 2, flags: ["read_error"] })).toMatch(/odczytać/);
  });
});

describe("priceHardBlock", () => {
  const base = { oldPurchase: 100, oldRetail: 150, newPurchase: 105, newRetail: 157.5 };
  it("normalna zmiana przechodzi", () => {
    expect(priceHardBlock(base)).toBeNull();
    expect(priceHardBlock({ ...base, newRetail: null })).toBeNull();
  });
  it("przesunięty przecinek (×10 / ÷10) i cena ≤ 0 są blokowane", () => {
    expect(priceHardBlock({ ...base, newPurchase: 1050 })).toMatch(/kartotekowa rośnie 10,5×/);
    expect(priceHardBlock({ ...base, newRetail: 15 })).toMatch(/detaliczna spada do 10% obecnej.*−90%/);
    expect(priceHardBlock({ ...base, newPurchase: 0 })).toMatch(/≤ 0/);
  });
  it("brak starej ceny — sprawdzamy tylko > 0", () => {
    expect(priceHardBlock({ ...base, oldPurchase: null, newPurchase: 99999 })).toBeNull();
  });
});

describe("priceBackupCsv", () => {
  it("polski Excel: średnik, przecinek, BOM, cudzysłów przy średniku w nazwie", () => {
    const csv = priceBackupCsv([
      { symbol: "531664", name: "Ips; classic", backupPurchase: 42.37, backupRetail: 66.19, backupAt: "2026-10-05T16:00:00.000Z", nowPurchase: 43.07, nowRetail: null },
    ]);
    expect(csv.startsWith("\uFEFFSymbol;")).toBe(true);
    expect(csv).toContain('531664;"Ips; classic";42,3700;66,1900;2026-10-05T16:00:00.000Z;43,0700;\r\n');
  });
});

describe("isWithdrawnName", () => {
  it("wyprzedaż, outlet i wycofane — także doklejone i ucięte", () => {
    for (const n of [
      "Ips d.sign Effect 4 20g Wyprzedaż",
      "Ips d.sign mamelon material salmon 20gWyprzedaż",
      "IPS InLine Margin 20g 110/01 WYCOFANE",
      "SR Connect 5ml - płyn do aktywacji pow. kom WYCOFA",
      "Ips Empress Invest.Ring  system 100g 1 zestaw WYCO",
      "Outlet IPS e.max CAD Speed Crystallization Tray",
      "Telio CS Link wyprz.",
      "Wypr. Ivocolor",
      "IPS e.max Ceram Art pakiet 3 zestawów NIEAKTYWNY",
    ]) expect(isWithdrawnName(n)).toBe(true);
  });
  it("zwykłe towary zostają", () => {
    for (const n of ["IPS Style Ceram Gingiva Kit", "Programat P310 G2 + Vacuum pump VP3 Promocja", "Firing Plate 2 (SP)"]) {
      expect(isWithdrawnName(n)).toBe(false);
    }
  });
});

describe("profil Ivoclar", () => {
  const ivoclar = priceListProfile("ivoclar")!;
  it("oryginalny układ pliku: te same kolumny co rozpoznanie ogólne", () => {
    const res = profileColumns(IVOCLAR, ivoclar);
    expect(res).toEqual({ ok: true, columns: detectPriceListColumns(IVOCLAR) });
  });
  it("inny cennik: błąd z listą brakujących kolumn", () => {
    const other = [["Art.-Nr.", "Bezeichnung", "Listenpreis EUR"], ["123", "X", 10]];
    const res = profileColumns(other, ivoclar);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.missing).toContain("Cena Dealer netto PLN");
  });
  it("brak jednej kolumny wystarczy, żeby odrzucić", () => {
    const noDiscount = IVOCLAR.map((r) => r.filter((_, j) => j !== 7));
    const res = profileColumns(noDiscount, ivoclar);
    expect(res).toEqual({ ok: false, missing: ["Upust %"] });
  });
  it("nieznany profil", () => {
    expect(priceListProfile("gc")).toBeNull();
  });
});
