import { describe, expect, it } from "vitest";
import {
  summarizeZdProductPurchases,
  summarizeZdProductSales,
  type ZdProductSaleRow,
} from "./zd-product-history";

const sale = (p: Partial<ZdProductSaleRow>): ZdProductSaleRow => ({
  rola: "fs",
  dokNr: "FS 1",
  date: "2026-09-01",
  khId: 1,
  khSymbol: "A",
  khName: "Klient A",
  pieces: 1,
  ...p,
});

describe("summarizeZdProductSales", () => {
  it("jeden dominujący klient → kandydat na prośbę", () => {
    const s = summarizeZdProductSales([
      sale({ pieces: 40, date: "2026-03-02" }),
      sale({ pieces: 30, date: "2026-07-10" }),
      sale({ khId: 2, khSymbol: "B", khName: "Klient B", pieces: 5 }),
    ]);
    expect(s.customers).toBe(2);
    expect(s.top[0]).toMatchObject({ name: "Klient A", pieces: 70, docs: 2 });
    expect(s.verdict).toContain("Klient A (93%)");
  });

  it("jedna duża sprzedaż przy wielu klientach", () => {
    const rows = [sale({ khId: 9, khSymbol: "X", khName: "Hurt X", pieces: 60, dokNr: "FS 9" })];
    for (let i = 0; i < 6; i += 1) rows.push(sale({ khId: 10 + i, khSymbol: `K${i}`, khName: `K${i}`, pieces: 5, date: `2026-0${i + 1}-15` }));
    const s = summarizeZdProductSales(rows);
    expect(s.verdict).toMatch(/^Jedna sprzedaż to 67% roku \(60 szt, Hurt X/);
    expect(s.largest?.dokNr).toBe("FS 9");
  });

  it("paragony to detal, nie klient; zwrot pomniejsza klienta i sumę", () => {
    const s = summarizeZdProductSales([
      sale({ khSymbol: "PARAGON", khName: "PARAGON", khId: 3306, rola: "pa", pieces: 2, date: "2026-01-05" }),
      sale({ khSymbol: "PARAGON", khName: "PARAGON", khId: 3306, rola: "pa", pieces: 2, date: "2026-02-05" }),
      sale({ khId: 1, pieces: 4, date: "2026-03-05" }),
      sale({ khId: 2, khSymbol: "B", khName: "Klient B", pieces: 4, date: "2026-04-05" }),
      sale({ khId: 1, rola: "zw", pieces: -2, date: "2026-03-20" }),
    ]);
    expect(s.customers).toBe(2);
    expect(s.retailPieces).toBe(4);
    expect(s.pieces).toBe(10);
    expect(s.top.find((c) => c.name === "Klient A")?.pieces).toBe(2);
    expect(s.verdict).toBe("Sprzedaż rozproszona: 2 klientów + paragony, 4 z 12 miesięcy.");
  });
});

describe("summarizeZdProductPurchases", () => {
  it("typowa ilość i odstęp między ZD", () => {
    expect(
      summarizeZdProductPurchases([
        { dokNr: "ZD 3", date: "2026-09-01", qty: 72, priceNet: 10 },
        { dokNr: "ZD 2", date: "2026-07-01", qty: 36, priceNet: 10 },
        { dokNr: "ZD 1", date: "2026-05-01", qty: 72, priceNet: null },
      ])
    ).toEqual({ count: 3, typicalQty: 72, typicalGapDays: 62 });
  });

  it("para: paczki i sztuki z jednego ZD to jeden zakup, liczony w sztukach", () => {
    const rows = [
      { twId: 1, dokNr: "ZD 2", date: "2026-09-01", qty: 2, priceNet: null },
      { twId: 2, dokNr: "ZD 2", date: "2026-09-01", qty: 4, priceNet: null },
      { twId: 1, dokNr: "ZD 1", date: "2026-08-01", qty: 3, priceNet: null },
    ];
    expect(summarizeZdProductPurchases(rows, (r) => r.qty * (r.twId === 1 ? 10 : 1))).toEqual({
      count: 2,
      typicalQty: 27,
      typicalGapDays: 31,
    });
  });
});
