import { describe, expect, it } from "vitest";
import {
  buildLineProposalsPrompt,
  customsMaxOutputTokens,
  documentArticlesToPasteText,
  invoiceLinesToPasteText,
  parseDocumentArticlesExtraction,
  parseInvoiceExtraction,
  parseLineProposals,
} from "./customs-ai";
import { parseInvoiceLinesPaste } from "./customs-lines";

describe("parseInvoiceExtraction", () => {
  it("nazwa sprzedawcy tylko gdy jest (do rozpoznania dostawcy)", () => {
    const line = { code: "A1", name: "Bur", quantity: 1 };
    expect(parseInvoiceExtraction({ sellerName: " Shenzhen UP3D Technology Co., Ltd ", lines: [line] }).sellerName).toBe(
      "Shenzhen UP3D Technology Co., Ltd"
    );
    expect(parseInvoiceExtraction({ sellerName: "", lines: [line] })).not.toHaveProperty("sellerName");
  });
  it("normalizuje nagłówek i pozycje, odrzuca puste", () => {
    const inv = parseInvoiceExtraction({
      invoiceNumber: " AI/3177/26 ",
      invoiceDate: "2026-04-20",
      currency: "eur",
      total: "2237.50",
      hsCode: "9018.9090",
      countryOfOrigin: "Pakistan",
      lines: [
        { code: "de-1196", name: "Plaster knife large", quantity: 10, unitPrice: 4.5 },
        { code: "", name: "", quantity: 3 },
        { code: "DE-1698", name: "Scalpel handle", quantity: 0 },
        "junk",
      ],
    });
    expect(inv).toEqual({
      invoiceNumber: "AI/3177/26",
      invoiceDate: "2026-04-20",
      currency: "EUR",
      total: 2237.5,
      hsCode: "9018.9090",
      countryOfOrigin: "Pakistan",
      lines: [
        { supplierArticleCode: "DE-1196", supplierName: "Plaster knife large", quantity: 10, unitPrice: 4.5, subiektTwId: null },
      ],
    });
  });

  it("poprawia zapisy dat i walut, odrzuca nieczytelne", () => {
    const inv = parseInvoiceExtraction({ invoiceDate: "20/04/2026", currency: "euro" });
    expect(inv.invoiceDate).toBe("2026-04-20");
    expect(inv.currency).toBe("EUR");
    expect(parseInvoiceExtraction({ invoiceDate: "kiedyś", currency: "złotówki" })).toMatchObject({
      invoiceDate: null,
      currency: null,
    });
    expect(inv.lines).toEqual([]);
    expect(parseInvoiceExtraction(null).invoiceNumber).toBe("");
  });

  it("tekst do wklejenia wraca tym samym parserem bez strat", () => {
    const lines = parseInvoiceExtraction({
      lines: [
        { code: "DE-1196", name: "Knife\twith tab", quantity: 10, unitPrice: 4.5 },
        { code: "DE-1700", name: "Scalpel handle No.4", quantity: 2.5 },
      ],
    }).lines;
    const reparsed = parseInvoiceLinesPaste(invoiceLinesToPasteText(lines));
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.lines).toEqual([
      { ...lines[0], supplierName: "Knife with tab" },
      lines[1],
    ]);
  });
});

describe("parseDocumentArticlesExtraction", () => {
  it("normalizuje, usuwa duplikaty i kody ze spacjami", () => {
    const articles = parseDocumentArticlesExtraction({
      articles: [
        { code: "de-1411", description: "Mosquito forceps straight" },
        { code: "DE-1411", description: "dup" },
        { code: "Annex A", description: "nagłówek" },
        { code: "DE-1412" },
      ],
    });
    expect(articles).toEqual([
      { code: "DE-1411", description: "Mosquito forceps straight" },
      { code: "DE-1412", description: "" },
    ]);
    expect(documentArticlesToPasteText(articles)).toBe("DE-1411\tMosquito forceps straight\nDE-1412");
  });
});

describe("parseLineProposals", () => {
  it("przyjmuje tylko znane ref z opisem, CN normalizuje", () => {
    const out = parseLineProposals(
      {
        items: [
          { ref: "l1", descriptionPl: "Nożyk do wosku", material: "stal nierdzewna", cnCode: "9018 49 00" },
          { ref: "l1", descriptionPl: "duplikat", material: "", cnCode: "" },
          { ref: "l2", descriptionPl: "", material: "x", cnCode: "90184900" },
          { ref: "obcy", descriptionPl: "X", material: "", cnCode: "90184900" },
          { ref: "l3", descriptionPl: "Pęseta", material: "Stal", cnCode: "9018" },
          { ref: "l4", descriptionPl: "Płyta główna", material: "", cnCode: "85389099", cnCertain: false, cnReason: "PCB — zależy od urządzenia" },
        ],
      },
      new Set(["l1", "l2", "l3", "l4"])
    );
    expect(out).toEqual([
      { ref: "l1", descriptionPl: "Nożyk do wosku", material: "stal nierdzewna", cnCode: "90184900" },
      { ref: "l3", descriptionPl: "Pęseta", material: "stal", cnCode: null },
      { ref: "l4", descriptionPl: "Płyta główna", material: "", cnCode: "85389099", cnCertain: false, cnReason: "PCB — zależy od urządzenia" },
    ]);
  });
});

describe("buildLineProposalsPrompt", () => {
  it("zawiera przykłady zatwierdzone, pozycje i opis z deklaracji", () => {
    const prompt = buildLineProposalsPrompt({
      supplierName: "Aswad",
      shipmentDescription: "przyrządy używane w protetyce stomatologicznej",
      lines: [{ ref: "l1", code: "DE-1412", supplierName: "Mosquito curved", documentDescription: "Mosquito forceps curved" }],
      examples: [{ supplierName: "Mosquito straight", descriptionPl: "Kleszczyki Mosquito proste", material: "stal nierdzewna", cnCode: "90184900" }],
    });
    expect(prompt).toContain("Dostawca: Aswad");
    expect(prompt).toContain('"Mosquito straight" → opis: "Kleszczyki Mosquito proste"');
    expect(prompt).toContain('ref=l1 kod=DE-1412 nazwa="Mosquito curved" (w deklaracji: "Mosquito forceps curved")');
  });
});

describe("userFacingCustomsAiError", () => {
  it("rozpoznaje zły klucz i braki konfiguracji", async () => {
    const { userFacingCustomsAiError, CustomsAiUnavailableError } = await import("./customs-ai");
    expect(userFacingCustomsAiError(new Error('{"error":{"status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}'))).toMatch(/GOOGLE_AI_API_KEY/);
    expect(userFacingCustomsAiError(new CustomsAiUnavailableError())).toMatch(/Brak klucza/);
    expect(userFacingCustomsAiError(new SyntaxError("x"))).toMatch(/nieczytelną/);
    expect(userFacingCustomsAiError(new Error("other"))).toMatch(/ręcznie/);
  });
});

describe("opis grupy z faktury (scalona komórka)", () => {
  it("grupa w osobnym polu, nazwa bez doklejonej grupy — klucz karty się nie zmienia", () => {
    const inv = parseInvoiceExtraction({
      invoiceNumber: "upc260650-1",
      lines: [
        { code: "", name: "LT VBL2-R(18-15-13)", quantity: 100, group: "Dental Lithium Disilicate Glass Ceramic", kind: "goods" },
        {
          code: "",
          name: "Dental Lithium Disilicate Glass Ceramic LT VD2-R(18-15-13)",
          quantity: 25,
          group: "Dental Lithium Disilicate Glass Ceramic",
          kind: "goods",
        },
        { code: "", name: "D98-25 A3", quantity: 5, group: "", kind: "goods" },
      ],
    });
    expect(inv.lines.map((l) => [l.supplierName, l.invoiceGroup ?? null])).toEqual([
      ["LT VBL2-R(18-15-13)", "Dental Lithium Disilicate Glass Ceramic"],
      ["LT VD2-R(18-15-13)", "Dental Lithium Disilicate Glass Ceramic"],
      ["D98-25 A3", null],
    ]);
  });

  it("przechodzi przez pole „wklej z faktury” w szóstej kolumnie", () => {
    const text = invoiceLinesToPasteText([
      { supplierArticleCode: "", supplierName: "LT VBL2-R(18-15-13)", quantity: 100, unitPrice: 4, subiektTwId: null, invoiceGroup: "PMMA Block" },
    ]);
    expect(parseInvoiceLinesPaste(text).lines[0]).toMatchObject({ supplierName: "LT VBL2-R(18-15-13)", invoiceGroup: "PMMA Block" });
  });

  it("trafia do promptu propozycji AI", () => {
    const prompt = buildLineProposalsPrompt({
      supplierName: "Upcera",
      shipmentDescription: "",
      lines: [{ ref: "a", code: "", supplierName: "LT VBL2-R(18-15-13)", invoiceGroup: "Dental Lithium Disilicate Glass Ceramic" }],
      examples: [],
    });
    expect(prompt).toContain('grupa na fakturze: "Dental Lithium Disilicate Glass Ceramic"');
  });
});

describe("customsMaxOutputTokens", () => {
  it("daje 2.5 limit na fakturę z setkami pozycji, starszym modelom ich sufit", () => {
    expect(customsMaxOutputTokens("gemini-2.5-flash")).toBe(65_536);
    expect(customsMaxOutputTokens("gemini-2.0-flash")).toBe(8_192);
  });
});
