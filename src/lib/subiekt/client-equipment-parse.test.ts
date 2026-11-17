import { describe, expect, it } from "vitest";
import {
  equipmentFromInvoice,
  equipmentAndRepairsFromInvoice,
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
  const line = (id: number, tw: number, cena: number, ilosc = 1) => ({ ob_Id: id, ob_TowId: tw, tw_Nazwa: `Towar TEST ${tw}`, ob_CenaNetto: cena, ob_Ilosc: ilosc });
  const doc = (uwagi: string, lines: ReturnType<typeof line>[]) => ({ dok_Id: 1, dok_NrPelny: "FS 1/T/2026", dok_DataWyst: "2026-03-01", dok_Uwagi: uwagi, dok_Pozycja: lines });

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

  it("numer bez pozycji trafia do najdroższej pozycji (sprzęt), nie do części ani wysyłki", () => {
    const eq = equipmentFromInvoice(doc("SN X21TEST010", [line(1, 11, 112), line(2, 12, 3740), line(3, 13, 4)]));
    expect(eq.map((e) => [e.twId, e.serials])).toEqual([[12, ["X21TEST010"]]]);
  });

  it("kilka numerów: najdroższe pozycje po kolei, najwyżej tyle numerów, ile sztuk", () => {
    const eq = equipmentFromInvoice(doc("SN X1\nSN X21TEST021\nSN X21TEST022\nSN X21TEST023", [line(1, 21, 900, 2), line(2, 22, 700), line(3, 23, 5)]));
    // „X1” (2 znaki) jest za krótki nawet w wierszu SN; trzy pozostałe: dwa do pozycji 1 (2 szt.), jeden do pozycji 2.
    expect(eq.map((e) => [e.twId, e.serials]).sort()).toEqual([
      [21, ["X21TEST021", "X21TEST022"]],
      [22, ["X21TEST023"]],
    ]);
  });

  it("zakres pozycji „Poz 1 - 3 SN …” — numer do najdroższej pozycji z zakresu", () => {
    const eq = equipmentFromInvoice(
      doc("Poz 1 - 3 SN X21TEST031\nPoz 4 - 5 SN X21TEST032", [line(1, 31, 200), line(2, 32, 5000), line(3, 33, 50), line(4, 34, 4200), line(5, 35, 80)])
    );
    expect(eq.map((e) => [e.twId, e.serials]).sort()).toEqual([
      [32, ["X21TEST031"]],
      [34, ["X21TEST032"]],
    ]);
  });

  it("SN ze zgłoszenia ze spacją trafia na egzemplarz z faktury", () => {
    const eq = equipmentFromInvoice(doc("SN X2BTEST054", [line(1, 41, 3000)]));
    const ranked = rankEquipmentForTicket(eq, { invoice: "", product: "", serial: "x2btest 054" });
    expect(ranked[0]!.hint).toBe("serial");
  });

  // Kształt z faktury za naprawę: SN urządzenia w uwagach, na pozycjach części serwisowe i usługa wysyłki.
  it("faktura za naprawę (same części i usługi) to nie zakup — numer wraca jako naprawa", () => {
    const parts = new Set([51, 52]);
    const r = equipmentAndRepairsFromInvoice(
      { ...doc("SNX21TEST050", [line(1, 51, 78), line(2, 52, 234), line(3, 53, 12)]), dok_NrPelny: "FS 9/M/11/2026", dok_DataWyst: "2026-11-12T00:00:00" },
      (l) => !parts.has(Number(l.ob_TowId)) && l.ob_TowId !== 53
    );
    expect(r.items).toEqual([]);
    expect(r.repairs).toEqual([{ serial: "X21TEST050", invoiceId: 1, invoiceNumber: "FS 9/M/11/2026", invoiceDate: "2026-11-12" }]);
  });

  it("faktura z urządzeniem i częściami: numer do urządzenia, choć część jest droższa", () => {
    const r = equipmentAndRepairsFromInvoice(doc("SN X21TEST060", [line(1, 61, 900), line(2, 62, 3000)]), (l) => l.ob_TowId !== 62);
    expect(r.items.map((e) => [e.twId, e.serials])).toEqual([[61, ["X21TEST060"]]]);
    expect(r.repairs).toEqual([]);
  });
});
