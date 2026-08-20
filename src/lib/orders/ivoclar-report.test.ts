import { describe, expect, it } from "vitest";
import {
  advanceIvoclarListPage,
  buildIvoclarInventoryRow,
  buildIvoclarSelloutRow,
  buildIvoclarInventoryFileRows,
  buildIvoclarSelloutFileRows,
  classifyIvoclarPostal,
  isBlockingSelloutDataGap,
  isCancelledSubiektStatus,
  isInventoryReviewNote,
  isIvoclarReportExcludedSymbol,
  isSubiektProductBlocked,
  ivoclarReportFilename,
  ivoclarReportXlsxFilename,
  IVOCLAR_INVENTORY_FILE_COLUMNS,
  IVOCLAR_SELLOUT_FILE_COLUMNS,
  parseIvoclarArticle,
  parseIvoclarDateRange,
  previousCalendarMonthRange,
  previousCompleteIsoWeekRange,
  selloutPostalCodeForFile,
  sumSelloutQuantityByArticle,
  summarizeInventoryRows,
  summarizeSelloutRows,
} from "./ivoclar-report";

describe("parseIvoclarArticle", () => {
  it("bierze czysty numer jako Article", () => {
    expect(parseIvoclarArticle("517019")).toEqual({
      raw: "517019",
      article: "517019",
      hasSuffix: false,
    });
  });

  it("wycina numer z sufiksu wagi", () => {
    expect(parseIvoclarArticle("685586 / 100G")).toEqual({
      raw: "685586 / 100G",
      article: "685586",
      hasSuffix: true,
    });
  });

  it("traktuje brak cyfr jako pusty Article", () => {
    expect(parseIvoclarArticle("ABC")).toEqual({
      raw: "ABC",
      article: "",
      hasSuffix: false,
    });
  });

  it("bierze 4-cyfrowy Article, ale pomija rok", () => {
    expect(parseIvoclarArticle("1234")).toEqual({
      raw: "1234",
      article: "1234",
      hasSuffix: false,
    });
    expect(parseIvoclarArticle("ABC 2024")).toEqual({
      raw: "ABC 2024",
      article: "",
      hasSuffix: false,
    });
  });
});

describe("classifyIvoclarPostal", () => {
  it("akceptuje polski kod z myślnikiem", () => {
    expect(classifyIvoclarPostal("00-834")).toEqual({
      raw: "00-834",
      kind: "pl_hyphen",
      normalized: "00-834",
    });
  });

  it("nie przerabia pięciu cyfr na polski myślnik", () => {
    expect(classifyIvoclarPostal("00834")).toEqual({
      raw: "00834",
      kind: "five_digits",
      normalized: null,
    });
  });

  it("oznacza pusty kod", () => {
    expect(classifyIvoclarPostal("  ")).toEqual({
      raw: "",
      kind: "empty",
      normalized: null,
    });
  });
});

describe("previousCompleteIsoWeekRange", () => {
  it("we wtorek 18.08.2026 zwraca poprzedni pn–nd (10–16.08)", () => {
    expect(previousCompleteIsoWeekRange("2026-08-18")).toEqual({
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
    });
  });

  it("w poniedziałek bierze poprzedni pełny tydzień, nie bieżący", () => {
    expect(previousCompleteIsoWeekRange("2026-08-17")).toEqual({
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
    });
  });

  it("w niedzielę poprzedni tydzień to ten sprzed bieżącego pn–nd", () => {
    expect(previousCompleteIsoWeekRange("2026-08-16")).toEqual({
      dataOd: "2026-08-03",
      dataDo: "2026-08-09",
    });
  });
});

describe("previousCalendarMonthRange", () => {
  it("z sierpnia 2026 zwraca lipiec", () => {
    expect(previousCalendarMonthRange("2026-08-18")).toEqual({
      dataOd: "2026-07-01",
      dataDo: "2026-07-31",
    });
  });
});

describe("parseIvoclarDateRange", () => {
  it("odrzuca od > do", () => {
    expect(parseIvoclarDateRange("2026-08-16", "2026-08-10").ok).toBe(false);
  });

  it("odrzuca zakres dłuższy niż 31 dni", () => {
    const r = parseIvoclarDateRange("2026-07-01", "2026-08-02");
    expect(r.ok).toBe(false);
  });

  it("akceptuje tydzień włącznie", () => {
    expect(parseIvoclarDateRange("2026-08-10", "2026-08-16")).toEqual({
      ok: true,
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
      dayCount: 7,
    });
  });
});

describe("ivoclarReportFilename", () => {
  it("wstawia YYYYMM i numer klienta ze spacją jak w procedurze", () => {
    expect(ivoclarReportFilename("Sellout", "2026-08-16")).toBe(
      "Sellout_202608_ 7036494"
    );
    expect(ivoclarReportFilename("Inventory", "2026-08-16")).toBe(
      "Inventory_202608_ 7036494"
    );
    expect(ivoclarReportXlsxFilename("Sellout", "2026-08-16")).toBe(
      "Sellout_202608_ 7036494.xlsx"
    );
  });
});

describe("kolejność kolumn pliku Ivoclar", () => {
  it("Sellout A–F jak w procedurze", () => {
    expect([...IVOCLAR_SELLOUT_FILE_COLUMNS]).toEqual([
      "Country",
      "Article",
      "Quantity",
      "PostalCode",
      "End User specification",
      "Sub-Dealer name",
    ]);
  });

  it("Inventory A–B jak w procedurze", () => {
    expect([...IVOCLAR_INVENTORY_FILE_COLUMNS]).toEqual(["Article", "Balance"]);
  });
});

describe("wiersze pliku Ivoclar", () => {
  it("Sellout ma A–F: ISO, Article, ilość, kod z myślnikiem, yes, puste Sub-Dealer", () => {
    const row = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Gabinet",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "Zestaw",
      quantity: 1,
      postalRaw: "00-834",
      city: "Warszawa",
    });
    const built = buildIvoclarSelloutFileRows([row]);
    expect(built.skippedCount).toBe(0);
    expect(built.rows).toEqual([
      {
        Country: "PL",
        Article: "517019",
        Quantity: 1,
        PostalCode: "00-834",
        "End User specification": "yes",
        "Sub-Dealer name": "",
      },
    ]);
  });

  it("pomija Sellout bez kraju albo kodu", () => {
    const missing = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS 1",
      dokDataWyst: "2026-08-12",
      khId: 1,
      khName: "X",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 1,
      postalRaw: "",
    });
    expect(buildIvoclarSelloutFileRows([missing])).toEqual({ rows: [], skippedCount: 1 });
  });

  it("Inventory tylko Article ze stanem > 0, posortowane", () => {
    const zero = buildIvoclarInventoryRow({
      twId: 1,
      twSymbol: "504393",
      twNazwa: "A",
      groupName: "G",
      balance: 0,
      reserved: 0,
      blocked: false,
    });
    const a = buildIvoclarInventoryRow({
      twId: 2,
      twSymbol: "504394",
      twNazwa: "B",
      groupName: "G",
      balance: 5,
      reserved: 0,
      blocked: false,
    });
    const b = buildIvoclarInventoryRow({
      twId: 3,
      twSymbol: "504377",
      twNazwa: "C",
      groupName: "G",
      balance: 7,
      reserved: 0,
      blocked: false,
    });
    const built = buildIvoclarInventoryFileRows([zero, a, b]);
    expect(built.skippedCount).toBe(1);
    expect(built.rows).toEqual([
      { Article: "504377", Balance: 7 },
      { Article: "504394", Balance: 5 },
    ]);
  });
});

describe("buildIvoclarSelloutRow", () => {
  it("oznacza luki danych i stałe luki API", () => {
    const row = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS 1/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Gabinet",
      twId: 11,
      twSymbol: "685586 / 100G",
      twNazwa: "Pasta",
      quantity: 2,
      postalRaw: "",
    });
    expect(row.article).toBe("685586");
    expect(row.dataGaps).toEqual(["article_suffix", "missing_postal"]);
    expect(row.apiGaps).toEqual(["country_iso"]);
    expect(row.suggestedCountry).toBeNull();
    expect(row.endUser).toBe("yes");
    expect(row.subDealerName).toBe("");
    expect(row.dataGaps.some(isBlockingSelloutDataGap)).toBe(true);
  });

  it("stawia PL przy kodzie XX-XXX i End User = yes", () => {
    const row = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Gabinet",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "Zestaw",
      quantity: 1,
      postalRaw: "00-834",
      city: "Warszawa",
    });
    expect(row.dataGaps).toEqual([]);
    expect(row.suggestedCountry).toBe("PL");
    expect(row.countrySource).toBe("postal_format");
    expect(row.apiGaps).toEqual([]);
    expect(selloutPostalCodeForFile(row)).toBe("00-834");
  });

  it("stawia DE przy 5 cyfrach i Düsseldorf, nie PL", () => {
    const row = buildIvoclarSelloutRow({
      dokId: 3,
      dokNr: "FS 3/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Labor",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "Zestaw",
      quantity: 1,
      postalRaw: "40210",
      city: "Düsseldorf",
    });
    expect(row.suggestedCountry).toBe("DE");
    expect(row.countrySource).toBe("city");
    expect(row.dataGaps).not.toContain("unknown_country");
    expect(row.apiGaps).toEqual([]);
    expect(row.endUser).toBe("yes");
  });

  it("pięć cyfr bez miasta nie jest Polską", () => {
    const row = buildIvoclarSelloutRow({
      dokId: 3,
      dokNr: "FS 3/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Gabinet",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "Zestaw",
      quantity: 1,
      postalRaw: "00834",
    });
    expect(row.suggestedCountry).toBeNull();
    expect(row.dataGaps).toContain("unknown_country");
    expect(row.apiGaps).toContain("country_iso");
  });
});

describe("summarize + aggregate", () => {
  it("agreguje ilość po Article", () => {
    const a = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS 1",
      dokDataWyst: "2026-08-10",
      khId: 1,
      khName: "A",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 2,
      postalRaw: "00-001",
    });
    const b = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2",
      dokDataWyst: "2026-08-11",
      khId: 2,
      khName: "B",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 3,
      postalRaw: "00-002",
    });
    expect(sumSelloutQuantityByArticle([a, b])).toEqual([
      { article: "517019", quantity: 5, lineCount: 2 },
    ]);
  });

  it("liczy luki blokujące osobno od sufiksu", () => {
    const ok = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS 1",
      dokDataWyst: "2026-08-10",
      khId: 1,
      khName: "A",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 1,
      postalRaw: "00-001",
    });
    const suffix = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2",
      dokDataWyst: "2026-08-10",
      khId: 1,
      khName: "A",
      twId: 11,
      twSymbol: "685586 / 100G",
      twNazwa: "Y",
      quantity: 1,
      postalRaw: "00-001",
    });
    const summary = summarizeSelloutRows([ok, suffix], {
      fsHeaderCount: 2,
      fsFetchedOk: 2,
      fsCancelledSkipped: 0,
      fsFetchErrors: 0,
      skippedNonIvoclarLines: 4,
      skippedZeroQtyLines: 0,
      skippedExcludedLines: 0,
      emptyDetailCount: 0,
    });
    expect(summary.ivoclarLineCount).toBe(2);
    expect(summary.rowsWithDataGaps).toBe(1);
    expect(summary.rowsWithBlockingDataGaps).toBe(0);
    expect(summary.skippedNonIvoclarLines).toBe(4);
    expect(summary.countryResolvedCount).toBe(2);
    expect(summary.countryUnknownCount).toBe(0);
    expect(summary.countryMissingAddressCount).toBe(0);
  });

  it("nie miesza PARAGON-u i konfliktu z krajem niejasnym", () => {
    const missing = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS 1",
      dokDataWyst: "2026-08-10",
      khId: 1,
      khName: "PARAGON",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 1,
      postalRaw: "",
    });
    const conflict = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2",
      dokDataWyst: "2026-08-10",
      khId: 2,
      khName: "Mix",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 1,
      postalRaw: "00-834",
      city: "Düsseldorf",
    });
    const unknown = buildIvoclarSelloutRow({
      dokId: 3,
      dokNr: "FS 3",
      dokDataWyst: "2026-08-10",
      khId: 3,
      khName: "X",
      twId: 10,
      twSymbol: "517019",
      twNazwa: "X",
      quantity: 1,
      postalRaw: "00834",
    });
    const summary = summarizeSelloutRows([missing, conflict, unknown], {
      fsHeaderCount: 3,
      fsFetchedOk: 3,
      fsCancelledSkipped: 0,
      fsFetchErrors: 0,
      skippedNonIvoclarLines: 0,
      skippedZeroQtyLines: 0,
      skippedExcludedLines: 0,
      emptyDetailCount: 0,
    });
    expect(summary.countryMissingAddressCount).toBe(1);
    expect(summary.countryConflictCount).toBe(1);
    expect(summary.countryUnknownCount).toBe(1);
    expect(summary.countryResolvedCount).toBe(0);
  });
});

describe("inventory notes", () => {
  it("oznacza zero i blokadę", () => {
    const row = buildIvoclarInventoryRow({
      twId: 1,
      twSymbol: "517019",
      twNazwa: "X",
      groupName: "Clinical",
      balance: 0,
      reserved: 2,
      blocked: true,
    });
    expect(row.notes).toEqual(["blocked", "zero_stock"]);
    expect(row.notes.some(isInventoryReviewNote)).toBe(true);
    const summary = summarizeInventoryRows([row]);
    expect(summary).toEqual({
      skuCount: 1,
      zeroStockCount: 1,
      blockedCount: 1,
      suffixCount: 0,
      emptyArticleCount: 0,
    });
  });
});

describe("isIvoclarReportExcludedSymbol", () => {
  it("pomija TRIPLEX ZESTAW i PROBASE ZESTAW niezależnie od wielkości liter", () => {
    expect(isIvoclarReportExcludedSymbol("TRIPLEX ZESTAW")).toBe(true);
    expect(isIvoclarReportExcludedSymbol("triplex zestaw")).toBe(true);
    expect(isIvoclarReportExcludedSymbol(" PROBASE   ZESTAW ")).toBe(true);
    expect(isIvoclarReportExcludedSymbol("517019")).toBe(false);
  });
});

describe("isSubiektProductBlocked", () => {
  it("uznaje 1, true i napisy", () => {
    expect(isSubiektProductBlocked(1)).toBe(true);
    expect(isSubiektProductBlocked(true)).toBe(true);
    expect(isSubiektProductBlocked("true")).toBe(true);
    expect(isSubiektProductBlocked("1")).toBe(true);
    expect(isSubiektProductBlocked(0)).toBe(false);
    expect(isSubiektProductBlocked(false)).toBe(false);
    expect(isSubiektProductBlocked(null)).toBe(false);
  });
});

describe("isCancelledSubiektStatus", () => {
  it("wykrywa anulowaną FS", () => {
    expect(isCancelledSubiektStatus("Anulowany")).toBe(true);
    expect(isCancelledSubiektStatus("Wystawiony")).toBe(false);
  });
});

describe("advanceIvoclarListPage", () => {
  it("bez totalPages idzie dalej przy pełnej stronie", () => {
    expect(
      advanceIvoclarListPage({
        page: 1,
        pageSize: 200,
        chunkLength: 200,
        totalPages: undefined,
        maxPages: 7,
      })
    ).toEqual({ kind: "next", page: 2 });
  });

  it("bez totalPages kończy na niepełnej stronie", () => {
    expect(
      advanceIvoclarListPage({
        page: 2,
        pageSize: 200,
        chunkLength: 15,
        totalPages: undefined,
        maxPages: 7,
      })
    ).toEqual({ kind: "done" });
  });

  it("z totalPages kończy na ostatniej stronie", () => {
    expect(
      advanceIvoclarListPage({
        page: 3,
        pageSize: 200,
        chunkLength: 200,
        totalPages: 3,
        maxPages: 7,
      })
    ).toEqual({ kind: "done" });
  });

  it("przerywa po maxPages", () => {
    expect(
      advanceIvoclarListPage({
        page: 7,
        pageSize: 200,
        chunkLength: 200,
        totalPages: undefined,
        maxPages: 7,
      })
    ).toEqual({ kind: "overflow" });
  });
});
