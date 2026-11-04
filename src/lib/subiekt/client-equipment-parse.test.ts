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
