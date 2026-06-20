import { describe, expect, it } from "vitest";
import {
  zdContractorInitialDataOd,
  zdContractorInitialDataOdForPlacement,
  zdPlacementListWindowForApi,
  placementIsOlderThanRollingWindow,
} from "./zd-search-scope";
import {
  brandTokensFromProductName,
  effectiveProductSymbol,
  extractAlphanumericProductCodeFromName,
  zdSearchTokensFromProduct,
  prioritizeZdLiveSearchPlans,
  zdSearchPlansForOrderInput,
  zdSearchPlansForOrderWithKhIds,
  zdSearchPlansForProductSupplierLookup,
} from "./zd-search-for-product";

describe("zdSearchPlansForOrderInput", () => {
  it("dla numerycznego symbolu buduje plany z nazwy towaru", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "00187",
      products: "Viva Flex polish",
      subiekt_tw_id: 2319,
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => "search" in p && p.search)).toBe(true);
    expect(plans.some((p) => p.search?.toLowerCase().includes("viva"))).toBe(true);
  });

  it("wyciąga markę Renfert z nazwy z łącznikiem", () => {
    expect(brandTokensFromProductName("Renfert-Waxlectric Light I")).toContain("Renfert");
  });

  it("planuje wyszukiwanie ZD po symbolu numerycznym (symbol + search)", () => {
    const plans = zdSearchPlansForProductSupplierLookup(
      {
        tw_Id: 999,
        tw_Symbol: "18080500",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      [{ id: "renfert", name: "renfert - excel", subiektKhId: 17465 }]
    );
    expect(plans.some((p) => p.symbol === "18080500" && p.search === "18080500")).toBe(true);
  });

  it("planuje wyszukiwanie ZD po marce i kh_Id dostawcy", () => {
    const plans = zdSearchPlansForProductSupplierLookup(
      {
        tw_Id: 198,
        tw_Symbol: "21500000",
        tw_Nazwa: "Renfert-Waxlectric Light I",
      },
      [{ id: "renfert", name: "renfert - excel", subiektKhId: 17465 }]
    );
    expect(plans.some((p) => p.search === "Renfert" && p.khId === 17465)).toBe(true);
  });

  it("nie ucina długiego numerycznego symbolu przez limit tokenów", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "18080500",
        // dużo słów, żeby przekroczyć limit
        tw_Nazwa: "Bardzo długa nazwa produktu testowego z wieloma tokenami Renfert Waxlectric Light Extra",
      },
      6
    );
    expect(tokens).toContain("18080500");
  });

  it("wyciąga długi kod numeryczny z nazwy gdy brak symbolu", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "-",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      8
    );
    expect(tokens).toContain("18080500");
  });

  it("rozbija tokeny z łącznikami i plusami (MT3+tarcza)", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "18080500",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      12
    );
    expect(tokens).toContain("Renfert");
    expect(tokens.some((t) => t.toLowerCase() === "mt3")).toBe(true);
    expect(tokens.some((t) => t.toLowerCase() === "tarcza")).toBe(true);
  });

  it("wyciąga kod alfanumeryczny z nazwy (H364RNF)", () => {
    expect(extractAlphanumericProductCodeFromName("Komet węglik H364RNF")).toBe(
      "H364RNF"
    );
    expect(
      effectiveProductSymbol({
        tw_Id: 0,
        tw_Symbol: "-",
        tw_Nazwa: "Komet węglik H364RNF",
      })
    ).toBe("H364RNF");
    expect(
      zdSearchPlansForOrderInput({
        symbol: "-",
        products: "Komet węglik H364RNF",
      }).some((p) => p.search === "H364RNF")
    ).toBe(true);
  });

  it("nie traktuje całej nazwy jako marki bez łącznika", () => {
    expect(brandTokensFromProductName("Komet węglik H364RNF")).toEqual(["Komet"]);
  });

  it("ogranicza plany prośby do ostatnich 3 miesięcy u kontrahenta", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "ABC",
      products: "Produkt test",
      subiekt_kh_id: 688,
    });
    expect(plans.every((p) => p.dataOd === zdContractorInitialDataOd())).toBe(true);
  });

  it("stare zgłoszenie — dataOd planu sięga okresu zamówienia", () => {
    const placementAt = "2026-02-10";
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
  const window = placementIsOlderThanRollingWindow(placementAt, syncAt)
    ? zdPlacementListWindowForApi(placementAt, syncAt)
    : { dataOd: zdContractorInitialDataOdForPlacement(placementAt, syncAt) };
    const plans = zdSearchPlansForOrderInput({
      symbol: "606402",
      products: "Produkt DFS",
      subiekt_kh_id: 100,
      placementAt,
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.dataOd === window.dataOd && p.dataDo === window.dataDo)).toBe(
      true
    );
    expect(window.dataOd).toBe("2026-01-01");
    expect(window.dataDo).toBe("2026-05-01");
    expect(window.dataOd < zdContractorInitialDataOd(syncAt)).toBe(true);
  });

  it("dodaje khId do planów gdy dostawca jest powiązany", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "ABC",
      products: "Produkt test",
      subiekt_kh_id: 688,
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.khId === 688)).toBe(true);
  });

  it("łączy plany dla wielu kh_Id dostawcy bez duplikatów", () => {
    const plans = zdSearchPlansForOrderWithKhIds(
      {
        symbol: "ABC",
        products: "Produkt test",
      },
      [100, 200]
    );
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.khId === 100)).toBe(true);
    expect(plans.some((p) => p.khId === 200)).toBe(true);
  });

  it("priorytetyzuje plan po symbolu przed marką z nazwy", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "-",
      products: "Komet węglik H364RNF",
      subiekt_kh_id: 9001,
    });
    expect(plans[0]?.symbol).toBe("H364RNF");
    expect(plans[0]?.search).toBe("H364RNF");
    expect(plans[0]?.khId).toBe(9001);
  });

  it("filtruje kontrahenta kh_Id mimo rozjechanej nazwy dostawcy w aplikacji", () => {
    const plans = zdSearchPlansForOrderWithKhIds(
      {
        symbol: "-",
        products: "Komet węglik H364RNF",
      },
      [9001, 9002]
    );
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.khId === 9001 || p.khId === 9002)).toBe(true);
    expect(plans.every((p) => p.name == null)).toBe(true);
  });

  it("nie używa filtra name w planach wyszukiwania ZD", () => {
    const plans = zdSearchPlansForOrderWithKhIds(
      { symbol: "ABC", products: "Produkt test" },
      [688]
    );
    expect(plans.every((p) => p.name == null)).toBe(true);
    expect(plans.some((p) => p.khId === 688)).toBe(true);
  });
});

describe("prioritizeZdLiveSearchPlans", () => {
  it("preferuje plan symbol+search z głównym kh_Id", () => {
    const plans = prioritizeZdLiveSearchPlans(
      [
        { search: "Komet", khId: 9002, pageSize: 12, page: 1 },
        { symbol: "H364RNF", search: "H364RNF", khId: 9001, pageSize: 12, page: 1 },
        { search: "węglik", khId: 9001, pageSize: 12, page: 1 },
      ],
      { primaryKhId: 9001, maxPlans: 2 }
    );
    expect(plans).toHaveLength(2);
    expect(plans[0]?.symbol).toBe("H364RNF");
    expect(plans[0]?.khId).toBe(9001);
  });
});
