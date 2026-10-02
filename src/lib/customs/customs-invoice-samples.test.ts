/**
 * Faktury dostawców spoza UE, dla których robimy odprawy — odpowiedzi AI w kształcie,
 * jaki zwraca Gemini dla tych PDF-ów, i mail Saeshin do agencji wysłany wcześniej z poczty.
 */
import { describe, expect, it } from "vitest";
import { invoiceLinesToPasteText, invoiceReadWarnings, parseInvoiceDate, parseInvoiceExtraction } from "./customs-ai";
import { parseInvoiceLinesPaste } from "./customs-lines";
import { customsArticleKey, formatCustomsAgencyEmail, type CustomsEmailLine } from "./customs-clearance";
import { parseCustomsEmailText } from "./customs-email-import";

// Saeshin CSSP202604-056 — strona 1 „Same As Attached”, pozycje w załączniku, potem packing list.
const SAESHIN_LINES: [string, number, number][] = [
  ["FORTE100III HANDPIECE ONLY", 10, 150],
  ["FORTE100IIP(GRAY) HANDPIECE ONLY", 5, 120],
  ["FORTE100αIII HANDPIECE ONLY", 30, 130],
  ["STRONG 105L(BLUE) HANDPIECE ONLY", 60, 35],
  ['105L(BL):"C" SNAP RING', 20, 0.2],
  ['105L(BL):COLLET CHUCK "A"', 30, 7],
  ["105L(BL):CORD ASS'Y", 6, 3],
  ["105L(BL):DELRIN JOINT", 20, 0.3],
  ["105L(BL):FLAT WASHER", 20, 0.2],
  ["105L(BL):WAVE WASHER", 20, 0.2],
  ["F100aIII:BEARING STAND A ASSY(MOTOR CASE A ASS'Y)", 2, 3],
  ['F100aIII:BUSHING "A"', 10, 0.2],
  ["F100aIII:COLLET CHUCK", 50, 7],
  ["F100aIII:CORD ASS'Y", 100, 25],
  ["F100aIII:DELRIN JOINT", 10, 0.3],
  ["F100aIII:FRONT PART ASSY", 20, 50],
  ["F100aIII:HANDLE CAM ASS'Y", 15, 15],
  ["F100aIII:NOSE TIP", 5, 2],
  ["F100aIII:SPINDLE ASSY", 20, 25],
  ["F100III:CORD ASS'Y", 6, 25],
  ["F100IIP(GY):BOBBIN ASS'Y", 2, 40],
  ['F400aI:BUSHING "B"', 10, 0.2],
  ["F400aI:COLLET CHUCK CASE ASS'Y", 20, 20],
  ["F400aI:CORD ASS'Y", 25, 25],
  ["F400aI:DELRIN JOINT", 30, 0.3],
  ["F400aI:FLAT WASHER", 15, 0.2],
  ["F400aI:FRONT PART ASSY", 15, 50],
  ["F400aI:HANDLE CAM ASS'Y", 10, 15],
  ['F400aI:MOTOR CASE "A" ASS\'Y', 7, 16],
  ["F400aI:NOSE TIP ASS'Y", 5, 3],
  ["F400aI:NOSE TIP CAP", 5, 1],
  ["F400aI:SNAP RING", 20, 0.2],
  ["H180:ARMATURE & MOTOR CASE ASS'Y", 2, 60],
  ["105L(BL):BALL BEARING (1260zz)", 20, 4],
  ["105L(BL):BALL BEARING (1480zz)", 20, 4],
  ["105L(BL):BALL BEARING (830ZZ)", 20, 4],
  ["B150:MAIN PCB ASS'Y", 5, 0], // N.C.V.
  ["F100aIII:BALL BEARING (1050zz)", 200, 4],
  ["F100aIII:BALL BEARING (1360zz)", 150, 4],
  ["F100aIII:BALL BEARING(R188zz)", 150, 7],
  ["F100II:BALL BEARING (1370zz)", 20, 4],
  ["F200a:PCB ASS'Y POWER PART", 2, 100],
  ["F400aI:BALL BEARING(840zz)", 40, 4],
];

const saeshinHeader = {
  invoiceNumber: "CSSP202604-056",
  invoiceDate: "April 28, 2026",
  currency: "EUR",
  total: 18497,
  countryOfOrigin: "Korea",
};

// Mail do agencji dla tej faktury, wysłany wcześniej z poczty.
const SAESHIN_EMAIL = `Dane na fakturze są poprawne.

Przesyłka zawiera:
1-4. Prostnice do mikrosilnika używanego w pracowniach protetyki stomatologicznej - kod CN 90184990
Części do prostnic używanych w pracowniach protetyki stomatologicznej
5. Podkładka
6. Zacisk wiertła
7. Przewód elektryczny
8. Plastikowa końcówka wrzeciona
9-10. Podkładka
11. Górna część silnika
12. Podkładka
13. Zacisk wiertła
14. Przewód elektryczny
15. Plastikowa końcówka wrzeciona
16. Przód prostnicy
17. Mechanizm otwierania
18. Nakładka na łożysko
19. Wrzeciono
20. Przewód elektryczny
21. Uzwojenie
22. Podkładka
23. Zacisk wiertła
24. Przewód elektryczny
25. Sprzęgiełko
26. Podkładka
27. Przód prostnicy
28. Mechanizm otwierania
29. Górna część silnika
30-31. Nakładka na łożysko
32. Pierścień zatrzaskowy
33. Silnik prostnicy
34-36. Łożyska kulkowe
37. Jednostka sterująca
38-41. Łożyska kulkowe
42. Płyta główna
43. Łożyska kulkowe

Stawka VAT 23%

Dostawa na adres:`;

describe("Saeshin — pozycje bez kodu artykułu", () => {
  const followsPrompt = parseInvoiceExtraction({
    ...saeshinHeader,
    lines: SAESHIN_LINES.map(([name, quantity, unitPrice]) => ({ code: "", name, quantity, unitPrice, kind: "goods" })),
  });

  it("43 pozycje, każda z własnym kluczem karty, suma zgodna z fakturą", () => {
    expect(followsPrompt.lines).toHaveLength(43);
    const keys = followsPrompt.lines.map((l) => customsArticleKey(l.supplierArticleCode, l.supplierName));
    expect(new Set(keys).size).toBe(43);
    expect(keys[5]).toBe("105L BL COLLET CHUCK A");
    expect(followsPrompt.invoiceDate).toBe("2026-04-28");
    expect(invoiceReadWarnings(followsPrompt)).toEqual([]);
  });

  it("model wycięty przez AI jako „kod” → te same klucze co pełna nazwa", () => {
    const split = parseInvoiceExtraction({
      ...saeshinHeader,
      lines: SAESHIN_LINES.map(([name, quantity, unitPrice]) => {
        const m = name.match(/^([^:]+):(.+)$/);
        return { code: m ? m[1] : "", name: m ? m[2] : name, quantity, unitPrice, kind: "goods" };
      }),
    });
    const keys = (inv: typeof split) => inv.lines.map((l) => customsArticleKey(l.supplierArticleCode, l.supplierName));
    expect(keys(split)).toEqual(keys(followsPrompt));
  });

  it("zdublowana packing list → ostrzeżenie o sumie", () => {
    const doubled = parseInvoiceExtraction({
      ...saeshinHeader,
      lines: [...SAESHIN_LINES, ...SAESHIN_LINES.slice(4)].map(([name, quantity, unitPrice]) => ({
        code: "",
        name,
        quantity,
        unitPrice,
      })),
    });
    expect(invoiceReadWarnings(doubled).join(" ")).toMatch(/nie zgadza się z kwotą faktury 18\s?497,00 EUR/);
  });
});

describe("UP3D, Song Young, PioCreat", () => {
  it("UP3D: „/” w kolumnie Model to brak kodu, shipping fee to koszt", () => {
    const inv = parseInvoiceExtraction({
      invoiceNumber: "INV2607071001890",
      invoiceDate: "2026-07-07",
      currency: "EUR",
      total: 8340,
      lines: [
        { code: "/", name: "T Burs Mag", quantity: 90, unitPrice: 10, amount: 900 },
        { code: "/", name: "T DC Burs Mag", quantity: 90, unitPrice: 20, amount: 1800 },
        { code: "/", name: "T Slot mill (T16: Metal)", quantity: 150, unitPrice: 25, amount: 3750 },
        { code: "/", name: "T Slot mill (T16: DLC)", quantity: 90, unitPrice: 20, amount: 1800 },
        { code: "/", name: "shipping fee", quantity: 1, unitPrice: 1, amount: 90 },
      ],
    });
    expect(inv.lines.map((l) => l.supplierArticleCode)).toEqual(["", "", "", ""]);
    expect(inv.lines.map((l) => customsArticleKey(l.supplierArticleCode, l.supplierName))).toEqual([
      "T BURS MAG",
      "T DC BURS MAG",
      "T SLOT MILL T16 METAL",
      "T SLOT MILL T16 DLC",
    ]);
    expect(inv.charges).toEqual([{ name: "shipping fee", amount: 90 }]);
    const warnings = invoiceReadWarnings(inv);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Pominięto koszty spoza towaru: shipping fee \(90,00 EUR\)/);
  });

  it("Song Young: kod w osobnej kolumnie, data z ukośnikami, waluta słownie", () => {
    const inv = parseInvoiceExtraction({
      invoiceNumber: "YINV260808",
      invoiceDate: "2026/08/10",
      currency: "U.S. DOLLARS",
      total: 1040,
      countryOfOrigin: "Taiwan",
      lines: [
        { code: "04250-1", name: "PKT.1 GOLD", quantity: 60, unitPrice: 5.2, kind: "goods" },
        { code: "04250-2", name: "PKT.2 GREEN", quantity: 60, unitPrice: 5.2, kind: "goods" },
        { code: "04250-4", name: "PKT.4 RED", quantity: 60, unitPrice: 5.2, kind: "goods" },
        { code: "04250-3", name: "PKT.3 BLUE", quantity: 20, unitPrice: 5.2, kind: "goods" },
      ],
    });
    expect(inv).toMatchObject({ invoiceDate: "2026-08-10", currency: "USD", countryOfOrigin: "Taiwan" });
    expect(inv.lines.map((l) => l.supplierArticleCode)).toEqual(["04250-1", "04250-2", "04250-4", "04250-3"]);
    expect(invoiceReadWarnings(inv)).toEqual([]);
  });

  it("PioCreat: data YYYYMMDD, nazwa produktu z opisem", () => {
    const inv = parseInvoiceExtraction({
      invoiceNumber: "CXSDCL20260327",
      invoiceDate: "20260327",
      currency: "USD",
      total: 1029,
      lines: [
        { code: "", name: "Pionext Mini printer", quantity: 1, unitPrice: 999, kind: "goods" },
        { code: "", name: "ACF Release Film Kit parts", quantity: 1, unitPrice: 30, kind: "goods" },
        { code: "", name: "shipping cost", quantity: 1, unitPrice: 0, amount: 0, kind: "charge" },
      ],
    });
    expect(inv.invoiceDate).toBe("2026-03-27");
    expect(inv.lines).toHaveLength(2);
    expect(inv.charges).toBeUndefined();
    expect(invoiceReadWarnings(inv)).toEqual([]);
  });
});

describe("Hong Kong Yatu (TIF z DHL) i skaner wewnątrzustny", () => {
  const yatu = parseInvoiceExtraction({
    invoiceNumber: "YT550721448",
    invoiceDate: "2025-07-21",
    currency: "USD",
    total: 2180,
    goodsTotal: 2000,
    hsCode: "8207909000",
    countryOfOrigin: "CN",
    lines: [
      { code: "", name: "Car needle FOR engrave", quantity: 60, unitPrice: 10, hsCode: "8207909000", kind: "goods" },
      { code: "", name: "Car needle FOR engrave", quantity: 80, unitPrice: 10, hsCode: "8207909000", kind: "goods" },
      { code: "", name: "Car needle FOR engrave", quantity: 60, unitPrice: 10, hsCode: "8207909000", kind: "goods" },
      { code: "", name: "Freight Cost", quantity: 1, unitPrice: 180, amount: 180, kind: "charge" },
    ],
  });

  it("trzy pozycje jednego artykułu, HS nadawcy przy pozycji, fracht ze stopki jako koszt", () => {
    expect(yatu.lines).toHaveLength(3);
    expect(new Set(yatu.lines.map((l) => customsArticleKey(l.supplierArticleCode, l.supplierName)))).toEqual(
      new Set(["CAR NEEDLE FOR ENGRAVE"])
    );
    expect(yatu.lines.every((l) => l.invoiceHsCode === "8207909000")).toBe(true);
    expect(invoiceReadWarnings(yatu)).toEqual(["Pominięto koszty spoza towaru: Freight Cost (180,00 USD)."]);
  });

  it("HS nadawcy przechodzi przez pole „pozycje z faktury”", () => {
    const text = invoiceLinesToPasteText(yatu.lines);
    expect(text.split("\n")[0]).toBe("\tCar needle FOR engrave\t60\t10\t8207909000");
    expect(parseInvoiceLinesPaste(text).lines[0]?.invoiceHsCode).toBe("8207909000");
  });

  it("Total Goods Value bez frachtu w pozycjach — suma liczona z samych towarów", () => {
    const inv = parseInvoiceExtraction({ ...yatu, lines: yatu.lines.map((l) => ({ name: l.supplierName, quantity: l.quantity, unitPrice: l.unitPrice })), goodsTotal: 2000, total: 2180 });
    expect(invoiceReadWarnings(inv)).toEqual([]);
  });

  it("mail do agencji: materiał po średniku, kod taryfy w wierszu pod pozycjami", () => {
    const mail = parseCustomsEmailText(`Dzień dobry,

Przesyłka zawiera:
1-3. Wiertła stosowane do frezarek, do frezowania różnych materiałów, np. pmma; materiał z którego zostały wykonane - stal, węglik, powłoka diamentowa
Kod taryfy celnej: 8207 70 90

Rodzaj odprawy celnej - dopuszczenie do obrotu

Dane do odprawy:
Mikran sp. z o.o.
ul. Wojskowa 3/L4
60-792 Poznań
NIP: PL7831008373`);
    expect(mail.maxPosition).toBe(3);
    expect(mail.sharedCnCode).toBeNull();
    for (const p of [1, 2, 3]) {
      expect(mail.byPosition.get(p)).toEqual({
        descriptionPl: "Wiertła stosowane do frezarek, do frezowania różnych materiałów, np. pmma",
        material: "stal, węglik, powłoka diamentowa",
        cnCode: "82077090",
        vatRate: null,
        isMedicalDevice: false,
      });
    }
  });

  it("kod taryfy pod blokiem dotyczy tylko pozycji bez własnego kodu", () => {
    const mail = parseCustomsEmailText("1. Prostnica - kod CN 90184990\n2. Podkładka\n3. Zacisk\nKod taryfy celnej: 8466 10 20\n4. Łożysko");
    expect(mail.byPosition.get(1)?.cnCode).toBe("90184990");
    expect(mail.byPosition.get(2)?.cnCode).toBe("84661020");
    expect(mail.byPosition.get(3)?.cnCode).toBe("84661020");
    expect(mail.byPosition.get(4)?.cnCode).toBeNull();
  });
});

describe("parseInvoiceDate", () => {
  it("czyta zapisy z faktur, nie zgaduje dwucyfrowego roku", () => {
    expect(parseInvoiceDate("2026-04-28")).toBe("2026-04-28");
    expect(parseInvoiceDate("April 28, 2026")).toBe("2026-04-28");
    expect(parseInvoiceDate("28 Apr 2026")).toBe("2026-04-28");
    expect(parseInvoiceDate("28.04.2026")).toBe("2026-04-28");
    expect(parseInvoiceDate("2026.4.8")).toBe("2026-04-08");
    expect(parseInvoiceDate("26/7/7")).toBeNull();
    expect(parseInvoiceDate("2026-02-30")).toBeNull();
  });
});

describe("Saeshin — opisy z wcześniejszego maila", () => {
  const parsed = parseCustomsEmailText(SAESHIN_EMAIL);

  it("43 pozycje po numerach, CN tylko przy prostnicach, wspólna stawka VAT", () => {
    expect(parsed.maxPosition).toBe(43);
    expect(parsed.byPosition.size).toBe(43);
    expect(parsed.sharedVatRate).toBe(23);
    expect(parsed.sharedCnCode).toBeNull();
    for (const p of [1, 2, 3, 4]) {
      expect(parsed.byPosition.get(p)).toEqual({
        descriptionPl: "Prostnice do mikrosilnika używanego w pracowniach protetyki stomatologicznej",
        material: "",
        cnCode: "90184990",
        vatRate: null,
        isMedicalDevice: false,
      });
    }
    expect(parsed.byPosition.get(9)?.descriptionPl).toBe("Podkładka");
    expect(parsed.byPosition.get(10)?.descriptionPl).toBe("Podkładka");
    expect(parsed.byPosition.get(25)?.descriptionPl).toBe("Sprzęgiełko");
    expect(parsed.byPosition.get(43)).toMatchObject({ descriptionPl: "Łożyska kulkowe", cnCode: null });
  });

  it("mail wygenerowany z tych opisów ma te same zakresy pozycji", () => {
    const lines: CustomsEmailLine[] = [...parsed.byPosition].map(([position, e]) => ({
      position,
      descriptionPl: e.descriptionPl,
      material: e.material,
      cnCode: e.cnCode,
      isMedicalDevice: e.isMedicalDevice,
      vatRate: e.vatRate ?? parsed.sharedVatRate!,
    }));
    const text = formatCustomsAgencyEmail({
      shipmentDescription: "prostnice do mikrosilnika i części do prostnic używanych w pracowniach protetyki stomatologicznej",
      lines,
    });
    expect(text).toContain(
      "1-4. Prostnice do mikrosilnika używanego w pracowniach protetyki stomatologicznej, kod CN 90184990\n5. Podkładka"
    );
    for (const row of ["9-10. Podkładka", "30-31. Nakładka na łożysko", "34-36. Łożyska kulkowe", "38-41. Łożyska kulkowe", "43. Łożyska kulkowe"]) {
      expect(text).toContain(row);
    }
    expect(text).toContain("Stawka VAT 23% dla wszystkich pozycji");
  });

  it("format aplikacji (Aswad) wraca z materiałem, VAT i wspólnym CN", () => {
    const aswad = parseCustomsEmailText(
      [
        "1) Dane na fakturze są poprawne",
        "2) Przesyłka zawiera przyrządy używane w protetyce stomatologicznej, kod taryfy celnej dla wszystkich:",
        "90184900",
        "",
        "1. Nożyk do gipsu duży, drewniana rękojeść, ostrze ze stali nierdzewnej, stawka VAT 23%",
        "2. Uchwyt do skalpela nr 3, stal nierdzewna, wyrób medyczny, stawka VAT 8%",
        "3) Mikran sp. z o.o.",
        "ul. Wojskowa 3/L4, 60-792 Poznań",
      ].join("\n")
    );
    expect(aswad.sharedCnCode).toBe("90184900");
    expect(aswad.shipmentDescription).toBe("przyrządy używane w protetyce stomatologicznej");
    expect(aswad.maxPosition).toBe(2);
    expect(aswad.byPosition.get(1)).toEqual({
      descriptionPl: "Nożyk do gipsu duży",
      material: "drewniana rękojeść, ostrze ze stali nierdzewnej",
      cnCode: null,
      vatRate: 23,
      isMedicalDevice: false,
    });
    expect(aswad.byPosition.get(2)).toMatchObject({ material: "stal nierdzewna", vatRate: 8, isMedicalDevice: true });
  });
});

describe("kontrole po przeglądzie", () => {
  it("sekcje maila numerowane kropką nie stają się pozycjami", () => {
    const mail = parseCustomsEmailText(
      "1. Dane na fakturze są poprawne\n2. Przesyłka zawiera przyrządy, kod taryfy celnej dla wszystkich: 90184900\n1. Nożyk\n2. Łopatka\n3. Mikran sp. z o.o."
    );
    expect(mail.maxPosition).toBe(2);
    expect(mail.byPosition.get(1)?.descriptionPl).toBe("Nożyk");
    expect(mail.byPosition.get(2)?.descriptionPl).toBe("Łopatka");
    expect(mail.sharedCnCode).toBe("90184900");
    expect(mail.shipmentDescription).toBe("przyrządy");
  });

  it("jeden powtórzony kod nie kasuje kodów reszty faktury (Aswad)", () => {
    const inv = parseInvoiceExtraction({
      lines: [
        { code: "DE-1196", name: "Plaster knife large", quantity: 10, unitPrice: 4.5 },
        { code: "DE-1196", name: "Plaster knife large, wooden handle", quantity: 2, unitPrice: 4.5 },
        { code: "DE-1698", name: "Scalpel handle No.3", quantity: 20, unitPrice: 2.1 },
        { code: "DE-1700", name: "Scalpel handle No.4", quantity: 20, unitPrice: 2.1 },
        { code: "DE-1411", name: "Mosquito forceps straight", quantity: 5, unitPrice: 3 },
      ],
    });
    expect(inv.lines.map((l) => l.supplierArticleCode)).toEqual(["", "", "DE-1698", "DE-1700", "DE-1411"]);
    expect(inv.lines[0]?.supplierName).toBe("DE-1196:Plaster knife large");
  });
});

describe("słownik CN 2026 i weryfikacja kodów", () => {
  it("odrzuca nieistniejące kody, zostawia tylko kandydatów z listy", async () => {
    const { cnDescription, cnLeaves, cnSiblings } = await import("./cn-nomenclature");
    const { buildCnVerifyPrompt, parseCnVerify } = await import("./customs-ai");
    expect(cnDescription("90184990")).toMatch(/dental/i);
    for (const bad of ["90184900", "84661000", "85030099", "82079090", "84433200"]) expect(cnDescription(bad)).toBeNull();
    expect(cnSiblings("90184900")).toEqual(["90184910", "90184990"]);
    expect(cnLeaves("848210").map((l) => l.code)).toEqual(["84821010", "84821090"]);

    const candidates = cnLeaves("8482");
    const prompt = buildCnVerifyPrompt([
      { ref: "b", supplierName: "105L(BL):BALL BEARING (1260zz)", descriptionPl: "Łożyska kulkowe", material: "stal", proposedCnCode: "84821090", candidates },
    ]);
    expect(prompt).toContain("84821010 — Ball bearings with greatest external diameter <= 30 mm");
    expect(prompt).toContain("1260zz → 12 mm");
    const allowed = new Map([["b", new Set(candidates.map((c) => c.code))]]);
    expect(parseCnVerify({ items: [{ ref: "b", cnCode: "8482 10 10", cnCertain: true, cnReason: "≤ 30 mm" }] }, allowed)).toEqual([
      { ref: "b", cnCode: "84821010", cnCertain: true, cnReason: "≤ 30 mm" },
    ]);
    // Kod spoza listy kandydatów → brak kodu i niepewność.
    expect(parseCnVerify({ items: [{ ref: "b", cnCode: "90184990", cnCertain: true, cnReason: "" }] }, allowed)[0]).toMatchObject({
      cnCode: null,
      cnCertain: false,
    });
  });

  it("widok: nieistniejący kod blokuje pozycję i podpowiada istniejące", async () => {
    const { createCnLookup } = await import("./cn-nomenclature");
    const { buildCustomsLineViews, isLineComplete } = await import("./customs-view");
    const views = buildCustomsLineViews({
      lines: [
        { id: "l1", position: 1, supplier_article_code: "DE-1196", supplier_name: "Knife", quantity: 1, unit: "szt.", unit_price: 1, amount: 1, zd_quantity: null },
      ],
      cardsByCode: new Map([
        ["DE-1196", { id: "c1", supplier_article_code: "DE-1196", description_pl: "Nożyk", material: "stal", cn_code: "90184900", is_medical_device: false, vat_rate: 23, vat_basis_document_id: null, status: "confirmed", source: "manual", confirmed_at: "2026-01-01" }],
      ]),
      documentIndex: new Map(),
      cn: createCnLookup(new Date("2026-10-02")),
    });
    expect(views[0]!.cnInvalid).toBe(true);
    expect(isLineComplete(views[0]!)).toBe(false);
    expect(views[0]!.cnWarning).toMatch(/Kodu 9018 49 00 nie ma w CN 2026 — istniejące w tej grupie: 9018 49 10, 9018 49 90/);
    // Słownik z poprzedniego roku tylko ostrzega.
    const next = buildCustomsLineViews({
      lines: [{ id: "l1", position: 1, supplier_article_code: "DE-1196", supplier_name: "Knife", quantity: 1, unit: "szt.", unit_price: 1, amount: 1, zd_quantity: null }],
      cardsByCode: new Map([["DE-1196", { id: "c1", supplier_article_code: "DE-1196", description_pl: "Nożyk", material: "stal", cn_code: "90184900", is_medical_device: false, vat_rate: 23, vat_basis_document_id: null, status: "confirmed", source: "manual", confirmed_at: "2026-01-01" }]]),
      documentIndex: new Map(),
      cn: createCnLookup(new Date("2027-02-01")),
    });
    expect(next[0]!.cnInvalid).toBe(false);
    expect(next[0]!.cnWarning).toMatch(/nie ma w CN 2026/);
  });
});

describe("mail z aplikacji wraca przez import bez strat", () => {
  it("opis z przecinkami i materiał po średniku", () => {
    const text = formatCustomsAgencyEmail({
      shipmentDescription: "wiertła",
      lines: [
        {
          position: 1,
          descriptionPl: "Wiertła stosowane do frezarek, np. pmma",
          material: "stal, węglik",
          cnCode: "82077090",
          isMedicalDevice: false,
          vatRate: 23,
        },
        { position: 2, descriptionPl: "Łożyska kulkowe", material: "stal", cnCode: "84821010", isMedicalDevice: false, vatRate: 23 },
      ],
    });
    const back = parseCustomsEmailText(text);
    expect(back.byPosition.get(1)).toMatchObject({ descriptionPl: "Wiertła stosowane do frezarek, np. pmma", material: "stal, węglik", cnCode: "82077090" });
    expect(back.byPosition.get(2)).toMatchObject({ descriptionPl: "Łożyska kulkowe", cnCode: "84821010" });
    expect(back.sharedVatRate).toBe(23);
  });
});
