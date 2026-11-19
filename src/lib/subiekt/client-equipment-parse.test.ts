import { describe, expect, it } from "vitest";
import {
  equipmentFromInvoice,
  hasSerialNotes,
  mergeClientEquipment,
  parseInvoiceSerialNotes,
  type ClientEquipmentItem,
} from "./client-equipment-parse";

// Format jak w Uwagach FS w Subiekcie; numery wymyślone.
const NOTES = "1. X10A1TESTR101\r\nX20A1TESTS102\r\nX30A1TESTF103\r\n7. 2026/001\r\n12. 9Z000000000001";

describe("parseInvoiceSerialNotes", () => {
  it("numer pozycji, wiersze bez numeru dopisane do poprzedniej pozycji", () => {
    const m = parseInvoiceSerialNotes(NOTES);
    expect([...m.entries()]).toEqual([
      [1, ["X10A1TESTR101", "X20A1TESTS102", "X30A1TESTF103"]],
      [7, ["2026/001"]],
      [12, ["9Z000000000001"]],
    ]);
  });
  it("zwykła uwaga przed numerami i tekst bez cyfr to nie numery seryjne", () => {
    expect(parseInvoiceSerialNotes("Dostawa kurierem\n1. Proszę o kontakt").size).toBe(0);
    expect(hasSerialNotes("wz trasa")).toBe(false);
    expect(hasSerialNotes(null)).toBe(false);
  });
  it("kilka numerów w jednym wierszu (przecinek, średnik) i nawias zamiast kropki", () => {
    expect([...parseInvoiceSerialNotes("2) SN111, SN222; SN333").entries()]).toEqual([[2, ["SN111", "SN222", "SN333"]]]);
  });
});

describe("equipmentFromInvoice", () => {
  const lines = Array.from({ length: 12 }, (_, i) => ({ ob_Id: 100 + i, ob_TowId: 1000 + i, tw_Symbol: `S${i + 1}`, tw_Nazwa: `Towar ${i + 1}` }));
  it("łączy numer z pozycją po kolejności ob_Id, nie po kolejności w odpowiedzi", () => {
    const shuffled = [...lines].reverse();
    const items = equipmentFromInvoice({ dok_Id: 5, dok_NrPelny: "FS 1/M/10/2026", dok_DataWyst: "2026-10-19T00:00:00", dok_Uwagi: NOTES, dok_Pozycja: shuffled });
    expect(items.map((i) => [i.twId, i.symbol, i.serials.length])).toEqual([
      [1000, "S1", 3],
      [1006, "S7", 1],
      [1011, "S12", 1],
    ]);
    expect(items[0]).toMatchObject({ invoiceNumber: "FS 1/M/10/2026", invoiceDate: "2026-10-19" });
  });
  it("numer pozycji spoza faktury jest pomijany", () => {
    expect(equipmentFromInvoice({ dok_Id: 1, dok_Uwagi: "40. SN999", dok_Pozycja: lines })).toEqual([]);
  });
});

describe("mergeClientEquipment", () => {
  const item = (invoiceId: number, date: string, serials: string[]): ClientEquipmentItem => ({
    twId: 7,
    symbol: "M",
    name: "Model",
    serials,
    invoiceId,
    invoiceNumber: `FS ${invoiceId}`,
    invoiceDate: date,
  });
  it("najnowsze najpierw, ten sam egzemplarz z dwóch faktur tylko raz", () => {
    const out = mergeClientEquipment([item(1, "2024-01-10", ["AB1", "AB2"]), item(2, "2026-03-01", ["ab1"])]);
    expect(out.map((o) => [o.invoiceId, o.serials])).toEqual([
      [2, ["ab1"]],
      [1, ["AB2"]],
    ]);
  });
});

describe("dropServiceProducts", () => {
  const it2 = (twId: number): ClientEquipmentItem => ({ twId, symbol: null, name: `T${twId}`, serials: ["SN1"], invoiceId: twId, invoiceNumber: "FS", invoiceDate: null });
  it("usługa (licencja z kluczem) odpada, towar i nieznany rodzaj zostają", async () => {
    const { dropServiceProducts } = await import("./client-equipment-parse");
    const out = dropServiceProducts([it2(1), it2(2), it2(3)], new Map([[1, 1], [2, 2], [3, null]]));
    expect(out.map((o) => o.twId)).toEqual([1, 3]);
  });
});

describe("format numeru seryjnego (paragony mają w uwagach adres kupującego)", () => {
  it("prefiks S/N, SN, nr nie jest częścią numeru", () => {
    expect([...parseInvoiceSerialNotes("3.S/N:A1234567").entries()]).toEqual([[3, ["A1234567"]]]);
    expect([...parseInvoiceSerialNotes("1. SN X99887766\n2) nr: QW-12345").entries()]).toEqual([
      [1, ["X99887766"]],
      [2, ["QW-12345"]],
    ]);
  });
  it("adres i kod pocztowy po numerze nie stają się numerami", () => {
    const notes = "Zamówienie: 140001\r\nJan Testowy\r\n2. ZZ00112233\r\nul. Przykładowa 53a\r\nWarszawa 01-267\r\n01-267\r\n16/1";
    expect([...parseInvoiceSerialNotes(notes).entries()]).toEqual([[2, ["ZZ00112233"]]]);
  });
  it("kilka numerów rozdzielonych spacją w wierszu z numerem pozycji", () => {
    expect([...parseInvoiceSerialNotes("4. AB12345 CD67890").entries()]).toEqual([[4, ["AB12345", "CD67890"]]]);
  });
});
