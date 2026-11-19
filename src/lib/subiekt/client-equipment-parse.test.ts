import { describe, expect, it } from "vitest";
import {
  hasSerialNotes,
  mergeClientEquipment,
  parseInvoiceSerialNotes,
  parseInvoiceSerialNotesFull,
  parseSalesDocNumber,
  rankEquipmentForTicket,
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

describe("parseSalesDocNumber", () => {
  it("z prefiksem i bez, spacje i wielkość liter", () => {
    expect(parseSalesDocNumber("FS 978/M/11/2026")).toEqual({ kind: "fs", key: "978/M/11/2026", nr: 978 });
    expect(parseSalesDocNumber(" fs978/m/11/2026 ")).toEqual({ kind: "fs", key: "978/M/11/2026", nr: 978 });
    expect(parseSalesDocNumber("978/M/11/2026")).toEqual({ kind: null, key: "978/M/11/2026", nr: 978 });
    expect(parseSalesDocNumber("PA 12/M/01/2025")?.kind).toBe("pa");
    expect(parseSalesDocNumber("faktura z maja")).toBeNull();
    expect(parseSalesDocNumber("")).toBeNull();
  });
});

describe("rankEquipmentForTicket", () => {
  const item = (name: string, invoiceNumber: string, invoiceId: number): ClientEquipmentItem => ({
    twId: invoiceId,
    symbol: null,
    name,
    serials: ["SN12345"],
    invoiceId,
    invoiceNumber,
    invoiceDate: "2025-01-01",
  });

  it("faktura ze zgłoszenia pierwsza, potem nazwa, reszta w kolejności", () => {
    const items = [item("Lampa Bluephase", "FS 1/M/01/2025", 1), item("Mikrosilnik Forte 200", "FS 2/M/01/2025", 2), item("Unit Sirona", "FS 3/M/01/2025", 3)];
    const ranked = rankEquipmentForTicket(items, { invoice: "3/M/01/2025", product: "mikrosilnik forte" });
    expect(ranked.map((r) => [r.invoiceId, r.hint])).toEqual([
      [3, "invoice"],
      [2, "product"],
      [1, null],
    ]);
  });

  it("bez wskazówek nie zmienia kolejności i nie dopasowuje krótkich słów", () => {
    const items = [item("Lampa LED", "FS 1/M/01/2025", 1), item("Kątnica", "FS 2/M/01/2025", 2)];
    expect(rankEquipmentForTicket(items, { invoice: "", product: "LED" }).map((r) => r.hint)).toEqual([null, null]);
    expect(rankEquipmentForTicket(items, { invoice: "", product: "katnica nie dziala" })[0]!.invoiceId).toBe(2);
  });

  it("FS i PA o tym samym numerze to różne dokumenty", () => {
    const items = [item("Lampa", "PA 5/M/01/2025", 1)];
    expect(rankEquipmentForTicket(items, { invoice: "FS 5/M/01/2025", product: "" })[0]!.hint).toBeNull();
  });
});

describe("rankEquipmentForTicket — numer seryjny", () => {
  it("egzemplarz o SN ze zgłoszenia przed fakturą i nazwą, bez wielkości liter i spacji", () => {
    const base = { symbol: null, invoiceDate: "2025-01-01" };
    const items: ClientEquipmentItem[] = [
      { ...base, twId: 1, name: "Mikrosilnik Forte", serials: ["AA111"], invoiceId: 1, invoiceNumber: "FS 1/M/01/2025" },
      { ...base, twId: 2, name: "Mikrosilnik Forte", serials: ["BB222", "X99TEST01"], invoiceId: 2, invoiceNumber: "FS 2/M/01/2025" },
    ];
    const ranked = rankEquipmentForTicket(items, { invoice: "1/M/01/2025", product: "Forte", serial: "x99 test01" });
    expect(ranked.map((r) => [r.invoiceId, r.hint])).toEqual([
      [2, "serial"],
      [1, "invoice"],
    ]);
  });
});

// Uwagi tak, jak wpisuje je większość handlowców: „SN …” bez numeru pozycji. Numery i nazwy wymyślone.
describe("numery seryjne bez numeru pozycji", () => {
  it("odmiany zapisu: SN, SN:, S/N z literą osobno, małe litery, sklejone SN, krótki numer", () => {
    const parse = (n: string) => parseInvoiceSerialNotesFull(n).loose;
    expect(parse("SN X21TEST001")).toEqual(["X21TEST001"]);
    expect(parse("SN: X21TEST002")).toEqual(["X21TEST002"]);
    expect(parse("S/N: A 1404999")).toEqual(["A1404999"]);
    expect(parse("sn 442999")).toEqual(["442999"]);
    expect(parse("SNX21TEST003")).toEqual(["X21TEST003"]);
    expect(parse("SN 9399")).toEqual(["9399"]);
    expect(parse("SN X2BTEST 054")).toEqual(["X2BTEST054"]);
    // Numer zaczynający się od „SN” i cyfry zostaje cały — „SN” to tu część numeru, nie prefiks.
    expect(parse("SN11122")).toEqual(["SN11122"]);
    // Adres i zwykła uwaga to nie numery.
    expect(parse("Proszę o kontakt\nul. Testowa 53a")).toEqual([]);
    expect(hasSerialNotes("SN X21TEST001")).toBe(true);
    // Sam numer w wierszu (litery i cyfry) — tak; numer dokumentu, rok, słowo — nie.
    expect(parse("X21TEST004")).toEqual(["X21TEST004"]);
    expect(parse("t12xy028")).toEqual(["t12xy028"]);
    expect(parse("FS 12/T/2026\n2026\nGwarancja")).toEqual([]);
  });

  it("SN ze zgłoszenia ze spacją trafia na egzemplarz z faktury", () => {
    const eq: ClientEquipmentItem[] = [{ twId: 41, symbol: null, name: "Towar TEST 41", serials: ["X2BTEST054"], invoiceId: 1, invoiceNumber: "FS 1/T/2026", invoiceDate: "2026-03-01" }];
    const ranked = rankEquipmentForTicket(eq, { invoice: "", product: "", serial: "x2btest 054" });
    expect(ranked[0]!.hint).toBe("serial");
  });

});

describe("uwagi z produkcji, które psuły przypisanie (numery wymyślone, układ jak na fakturach 11.2026)", () => {
  it("„Poz 4” w osobnym wierszu: numery z kolejnych wierszy idą do pozycji 4, „Poz 1” — do pozycji 1", () => {
    const m = parseInvoiceSerialNotes("Jan Testowy\nul. Przykładowa 1\r\nPoz 4\r\nX20R2TEST119\r\nX24R2TEST019\r\nPoz 1 \r\nB1600001\r\nB1600002");
    expect(m.get(4)).toEqual(["X20R2TEST119", "X24R2TEST019"]);
    expect(m.get(1)).toEqual(["B1600001", "B1600002"]);
  });

  it("numery części zestawu z etykietą (C.B, H.P, FOOT) są numerami; NIP i telefon nie", () => {
    const n = parseInvoiceSerialNotesFull("12345 kupon 5%\r\nC.B:X20R2TEST178\r\nH.P: X24R2TEST078\r\nFOOT:X09R2TEST178\r\nNIP: PL1234567890\r\ntel: 600100200");
    expect(n.labeled.flatMap((l) => l.serials)).toEqual(["X20R2TEST178", "X24R2TEST078", "X09R2TEST178"]);
  });

  it("„sn 302 i 304/2023” — dwa numery, spójnik pominięty", () => {
    expect(parseInvoiceSerialNotesFull("sn 302 i 304/2023").loose).toEqual(["302", "304/2023"]);
  });

  it("apostrof zamiast średnika nie odrzuca całego wiersza", () => {
    expect(parseInvoiceSerialNotes("1. X20R2TEST246' X20R2TEST278; X20R2TEST238").get(1)).toEqual(["X20R2TEST246", "X20R2TEST278", "X20R2TEST238"]);
  });
});
