import { describe, expect, it } from "vitest";
import { applyCorrections, classifyInvoiceEquipment, type TrustInputs } from "./client-equipment-trust";
import type { InvoiceForEquipment, InvoiceLine } from "./client-equipment-parse";

// Układy dokumentów jak na fakturach z 11.2026 (numery, nazwy firm i numery seryjne wymyślone).
const line = (id: number, twId: number, symbol: string, price: number, qty = 1, name = symbol): InvoiceLine => ({
  ob_Id: id,
  ob_TowId: twId,
  tw_Symbol: symbol,
  tw_Nazwa: name,
  ob_Ilosc: qty,
  ob_CenaNetto: price,
});
const doc = (uwagi: string, lines: InvoiceLine[], id = 100): InvoiceForEquipment => ({
  dok_Id: id,
  dok_NrPelny: `FS ${id}/M/07/2024`,
  dok_DataWyst: "2024-07-01T00:00:00",
  dok_Uwagi: uwagi,
  dok_Pozycja: lines,
});
const inputs = (devices: Record<number, boolean>, assignments: Record<string, number | null> = {}): TrustInputs => ({
  deviceModel: (tw) => (tw in devices ? devices[tw]! : null),
  assignment: (d, k) => (`${d}|${k}` in assignments ? assignments[`${d}|${k}`] : undefined),
  canBeDevice: (l) => Number(l.ob_CenaNetto) >= 100,
});

describe("classifyInvoiceEquipment — pewne tylko to, co wynika z dokumentu i decyzji", () => {
  it("cement droższy od mikrosilnika: numery bez pozycji nie idą do najdroższej — pytanie o każdy numer", () => {
    const d = doc("44444\r\nS/N: X27R4TEST158\r\nS/N: X20R1TEST158", [line(1, 10, "EVE", 27.64), line(2, 20, "STRONG210", 528.46), line(3, 30, "CEMENT", 959)]);
    const r = classifyInvoiceEquipment(d, inputs({ 20: true }));
    expect(r.trusted).toEqual([]);
    expect(r.pending.map((p) => (p.kind === "serial" ? [p.serial, p.candidates.map((c) => c.symbol)] : p.kind))).toEqual([
      ["X27R4TEST158", ["STRONG210", "CEMENT"]],
      ["X20R1TEST158", ["STRONG210", "CEMENT"]],
    ]);
  });

  it("po „Nie, to nie sprzęt” dla cementu jedyny kandydat to mikrosilnik — oba numery pewne, bez pytań", () => {
    const d = doc("S/N: X27R4TEST158\r\nS/N: X20R1TEST158", [line(1, 20, "STRONG210", 528.46), line(2, 30, "CEMENT", 959)]);
    const r = classifyInvoiceEquipment(d, inputs({ 20: true, 30: false }));
    expect(r.pending).toEqual([]);
    expect(r.trusted.map((t) => [t.symbol, t.serials])).toEqual([["STRONG210", ["X27R4TEST158", "X20R1TEST158"]]]);
  });

  it("numer wibratora na fakturze z droższą pinarką: pytanie, znane urządzenie pierwsze na liście", () => {
    const d = doc("11111\r\nsn VIB0000101", [line(1, 1, "KOLORNIK", 350), line(2, 2, "PINARKA", 4300), line(3, 3, "WIBRATOR", 400)]);
    const r = classifyInvoiceEquipment(d, inputs({ 2: true }));
    expect(r.trusted).toEqual([]);
    const p = r.pending[0]!;
    expect(p.kind === "serial" && p.candidates.map((c) => c.symbol)).toEqual(["PINARKA", "WIBRATOR", "KOLORNIK"]);
  });

  it("serwisant wskazał wibrator: numer pewny przy wibratorze; pinarka bez numeru zostaje jako sprzęt bez SN", () => {
    const d = doc("sn VIB0000101", [line(1, 2, "PINARKA", 4300), line(2, 3, "WIBRATOR", 400)]);
    const r = classifyInvoiceEquipment(d, inputs({ 2: true }, { "100|VIB0000101": 3 }));
    expect(r.pending).toEqual([]);
    expect(r.trusted.map((t) => [t.symbol, t.serials, t.quantity ?? null])).toEqual([
      ["WIBRATOR", ["VIB0000101"], null],
      ["PINARKA", [], 1],
    ]);
  });

  it("pomyłka w numeracji („Poz 10” na folię za 63 zł) nie przenosi numeru na inną pozycję — pytanie oznaczone", () => {
    const d = doc("33333\r\nPoz 10. X00001A", [line(1, 1, "PRASA", 1707.32), line(2, 2, "DLUTO", 1382.11), ...[3, 4, 5, 6, 7, 8, 9].map((n) => line(n, 50 + n, `M${n}`, 20)), line(10, 60, "FOLIA", 62.96)]);
    const r = classifyInvoiceEquipment(d, inputs({ 1: true, 2: true }));
    expect(r.trusted.map((t) => t.symbol)).toEqual([]);
    const p = r.pending[0]!;
    expect(p.kind === "serial" && [p.misplaced, p.candidates.map((c) => c.symbol)]).toEqual([true, ["PRASA", "DLUTO"]]);
  });

  it("numery przy pozycjach, model nieznany: pytanie o model z numerami; po „Tak” — pewne", () => {
    const d = doc("1. X20R2TEST176\r\nX24R2TEST016\r\n3. 2026/901", [line(1, 1, "SILNIK", 2430.89), line(2, 2, "IZOLATOR", 160.94), line(3, 3, "GARNEK", 678.54)]);
    const before = classifyInvoiceEquipment(d, inputs({}));
    expect(before.trusted).toEqual([]);
    expect(before.pending.map((p) => (p.kind === "model" ? [p.item.symbol, p.item.serials] : p.kind))).toEqual([
      ["SILNIK", ["X20R2TEST176", "X24R2TEST016"]],
      ["GARNEK", ["2026/901"]],
    ]);
    const after = classifyInvoiceEquipment(d, inputs({ 1: true, 3: true }));
    expect(after.pending).toEqual([]);
    expect(after.trusted.map((t) => t.symbol)).toEqual(["SILNIK", "GARNEK"]);
  });

  it("jedyna pozycja, która może być sprzętem: numer bez pozycji pewny, gdy model potwierdzony", () => {
    const d = doc("SN:X0000777", [line(1, 1, "LAKIER", 99), line(2, 2, "TURBINA", 2300)]);
    expect(classifyInvoiceEquipment(d, inputs({ 2: true })).trusted.map((t) => [t.symbol, t.serials])).toEqual([["TURBINA", ["X0000777"]]]);
  });

  it("faktura za naprawę (same części za grosze): numer to naprawa, nie sprzęt", () => {
    const r = classifyInvoiceEquipment(doc("SN X21TEST070", [line(1, 1, "SZCZOTKA", 40), line(2, 2, "USLUGA", 80)]), inputs({}));
    expect(r.trusted).toEqual([]);
    expect(r.pending).toEqual([]);
    expect(r.repairs.map((x) => x.serial)).toEqual(["X21TEST070"]);
    expect(r.repairs[0]!.lineNames).toEqual(["SZCZOTKA", "USLUGA"]);
  });

  it("numery licencji („Dot. licencji nr”) to nie sprzęt w naprawie", () => {
    const r = classifyInvoiceEquipment(doc("Dot. licencji nr:\r\n1. LIC-0000-TEST\r\n2. LIC-0001-TEST", [line(1, 1, "ABONAMENT", 80)]), inputs({}));
    expect(r).toEqual({ trusted: [], pending: [], repairs: [] });
  });

  it("decyzja „do żadnej pozycji” usuwa numer; model nieznany bez numeru nigdy nie jest sprzętem", () => {
    const d = doc("SN X21TEST071", [line(1, 1, "MATERIAL", 500, 3), line(2, 2, "LAMPA", 900, 2)]);
    const r = classifyInvoiceEquipment(d, inputs({ 2: true }, { "100|X21TEST071": null }));
    expect(r.pending).toEqual([]);
    expect(r.trusted.map((t) => [t.symbol, t.quantity])).toEqual([["LAMPA", 2]]);
  });
});

describe("classifyInvoiceEquipment — układy uwag", () => {
  it("numer pozycji liczony po ob_Id, nie po kolejności w odpowiedzi; pozycja spoza faktury pominięta", () => {
    const lines = [line(30, 3, "C", 900), line(10, 1, "A", 900), line(20, 2, "B", 900)];
    const r = classifyInvoiceEquipment(doc("2. X21TEST002\r\n40. X21TEST040", lines), inputs({ 1: true, 2: true, 3: true }));
    expect(r.trusted.filter((t) => t.serials.length).map((t) => [t.symbol, t.serials])).toEqual([["B", ["X21TEST002"]]]);
  });

  it("etykieta z nazwą produktu wskazuje pozycję wprost: numer lampy nie trafia do droższego garnka", () => {
    const d = doc("22222\r\nlampa s/n: XCL0000202\r\nGARNEK S/N: 2021/555", [
      line(1, 1, "LAMPA-1", 700, 1, "Lampa do polimeryzacji"),
      line(2, 2, "GAR-1", 1200, 1, "Garnek ciśnieniowy"),
    ]);
    const r = classifyInvoiceEquipment(d, inputs({ 1: true, 2: true }));
    expect(r.pending).toEqual([]);
    expect(r.trusted.map((t) => [t.symbol, t.serials])).toEqual([
      ["LAMPA-1", ["XCL0000202"]],
      ["GAR-1", ["2021/555"]],
    ]);
  });

  it("zestaw (3 numery na 1 szt.) obok kleszczy: pytanie, dopóki ktoś nie powie, że kleszcze to nie sprzęt", () => {
    const d = doc("Zamówienie: 1\r\nX20R2TEST042\r\nX79R1TEST042\r\nX09R2TEST042", [line(1, 1, "KLUCZYK", 8.8, 15), line(2, 2, "SILNIK", 2593.5), line(3, 3, "KLESZCZE", 259, 2)]);
    expect(classifyInvoiceEquipment(d, inputs({ 2: true })).pending).toHaveLength(3);
    const r = classifyInvoiceEquipment(d, inputs({ 2: true, 3: false }));
    expect(r.trusted.map((t) => [t.symbol, t.serials])).toEqual([["SILNIK", ["X20R2TEST042", "X79R1TEST042", "X09R2TEST042"]]]);
  });
});

describe("applyCorrections", () => {
  const base = { symbol: "S", name: "S", invoiceNumber: "FS 1", invoiceDate: "2026-01-01", unitPrice: 1000 };
  it("zwrot całości usuwa; zwrot części bez numerów zmniejsza ilość; z numerami — do wyjaśnienia", () => {
    const r = applyCorrections(
      [
        { ...base, twId: 1, invoiceId: 1, serials: ["A1"], lineQuantity: 1 },
        { ...base, twId: 2, invoiceId: 1, serials: [], quantity: 3, lineQuantity: 3 },
        { ...base, twId: 3, invoiceId: 2, serials: ["B1", "B2"], lineQuantity: 2 },
        { ...base, twId: 4, invoiceId: 3, serials: ["C1"], lineQuantity: 1 },
      ],
      new Map([
        [1, new Map([[1, 0], [2, 1]])],
        [2, new Map([[3, 1]])],
      ])
    );
    expect(r.returned).toBe(1);
    expect(r.trusted.map((t) => [t.twId, t.quantity ?? null])).toEqual([
      [2, 1],
      [4, null],
    ]);
    expect(r.pending.map((p) => (p.kind === "correction" ? [p.item.twId, p.remaining] : p.kind))).toEqual([[3, 1]]);
  });

  it("po oznaczeniu zwróconego numeru zostaje tyle numerów, ile sztuk — pozycja znów pewna", () => {
    const r = applyCorrections([{ ...base, twId: 3, invoiceId: 2, serials: ["B1"], lineQuantity: 2 }], new Map([[2, new Map([[3, 1]])]]));
    expect(r.pending).toEqual([]);
    expect(r.trusted.map((t) => t.serials)).toEqual([["B1"]]);
  });
});
