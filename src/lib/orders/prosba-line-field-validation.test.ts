import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  assessProsbaLineFields,
  shouldShowProsbaLineFieldValidation,
  prosbaLineHasTeethBlockers,
  prosbaLineHasSubmitBlockers,
} from "./prosba-line-field-validation";

const baseLine: ProductLineDraft = {
  id: "a",
  symbol: "",
  mikranCode: "",
  product: "",
  quantity: "",
};

describe("shouldShowProsbaLineFieldValidation", () => {
  it("nie pokazuje na pustej pierwszej pozycji bez próby wysłania", () => {
    expect(
      shouldShowProsbaLineFieldValidation(baseLine, {
        active: true,
        validationAttempted: false,
        lineCount: 1,
        requestKind: "zamowienie",
      })
    ).toBe(false);
  });

  it("pokazuje po próbie wysłania pustego formularza", () => {
    expect(
      shouldShowProsbaLineFieldValidation(baseLine, {
        active: true,
        validationAttempted: true,
        lineCount: 1,
        requestKind: "zamowienie",
      })
    ).toBe(true);
  });

  it("pokazuje na aktywnej pozycji po rozpoczęciu wpisywania", () => {
    expect(
      shouldShowProsbaLineFieldValidation(
        { ...baseLine, symbol: "A" },
        { active: true, validationAttempted: false, lineCount: 1, requestKind: "zamowienie" }
      )
    ).toBe(true);
  });

  it("liveValidation — po wpisaniu produktu bez ilości", () => {
    expect(
      shouldShowProsbaLineFieldValidation(
        { ...baseLine, product: "Wkręt", subiektTwId: 1 },
        {
          active: false,
          validationAttempted: false,
          liveValidation: true,
          lineCount: 1,
          requestKind: "zamowienie",
        }
      )
    ).toBe(true);
  });
});

describe("assessProsbaLineFields", () => {
  it("oznacza brak produktu jako błąd w trybie strict", () => {
    const fields = assessProsbaLineFields(baseLine, "zamowienie", "strict");
    expect(fields.symbol.state).toBe("error");
    expect(fields.product.message).toContain("nazwę lub symbol");
    expect(fields.mikranCode.state).toBe("default");
  });

  it("oznacza brak ilości przy zamówieniu", () => {
    const fields = assessProsbaLineFields(
      { ...baseLine, product: "Wkręt", subiektTwId: 1 },
      "zamowienie",
      "strict"
    );
    expect(fields.quantity.state).toBe("error");
    expect(fields.quantity.message).toContain("ilość");
  });

  it("nie wymaga ilości przy informacji", () => {
    const fields = assessProsbaLineFields(
      { ...baseLine, product: "Towar" },
      "informacja",
      "strict"
    );
    expect(fields.quantity.state).toBe("default");
  });
});

describe("prosbaLineHasTeethBlockers", () => {
  const TEETH_TW = 123;
  const teethExempt = { exemptTwIds: new Set([TEETH_TW]) };
  const teethLine: ProductLineDraft = {
    ...baseLine,
    product: "Ząb",
    quantity: "1",
    subiektTwId: TEETH_TW,
    teethManufacturer: "ivoclar",
    teethProductLine: "ivoclar_vivodent_dcl",
  };

  it("returns false when requestKind is not zamowienie", () => {
    expect(prosbaLineHasTeethBlockers(teethLine, "informacja", teethExempt)).toBe(false);
  });

  it("returns false when product is not on teeth registry (np. szczotka Wiedent)", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...baseLine,
          product: "Wiedent szczotka",
          quantity: "1",
          subiektTwId: 9999,
          teethManufacturer: "wiedent",
          teethProductLine: "wiedent_estetic",
        },
        "zamowienie",
        { exemptTwIds: new Set([TEETH_TW]) },
      ),
    ).toBe(false);
  });

  it("returns false when no teeth registry match", () => {
    expect(
      prosbaLineHasTeethBlockers(
        { ...teethLine, teethManufacturer: null, teethProductLine: null },
        "zamowienie",
      ),
    ).toBe(false);
  });

  it("returns true when teeth details are missing", () => {
    expect(
      prosbaLineHasTeethBlockers(
        { ...teethLine, teethDetails: undefined },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });

  it("returns true when teeth details lack jaw", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: null, kind: null }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });

  it("returns true when teeth details lack kind", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: "upper", kind: null }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });

  it("detects teeth product by exempt tw id without catalog hints", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethManufacturer: null,
          teethProductLine: null,
          teethDetails: undefined,
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });

  it("returns true when teeth details lack mould for ivoclar anterior", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethDetails: [{ position: 1, color: "A1", mould: null, jaw: "upper", kind: "anterior" }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });

  it("returns false when teeth details are complete for ivoclar (color + mould + jaw + kind)", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(false);
  });

  it("returns false when teeth details are complete for wiedent (color + mould + jaw + kind)", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          teethManufacturer: "wiedent",
          teethProductLine: "wiedent_estetic",
          teethDetails: [{ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(false);
  });

  it("respects quantity for expected count", () => {
    expect(
      prosbaLineHasTeethBlockers(
        {
          ...teethLine,
          quantity: "3",
          teethManufacturer: "wiedent",
          teethDetails: [
            { position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" },
            { position: 2, color: "B2", mould: "12", jaw: "upper", kind: "anterior" },
          ],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(true);
  });
});

describe("prosbaLineHasSubmitBlockers (with teeth)", () => {
  const TEETH_TW = 123;
  const teethExempt = { exemptTwIds: new Set([TEETH_TW]) };
  const teethLine: ProductLineDraft = {
    ...baseLine,
    product: "Ząb",
    quantity: "1",
    subiektTwId: TEETH_TW,
    teethManufacturer: "ivoclar",
    teethProductLine: "ivoclar_vivodent_dcl",
  };

  it("returns true when teeth details are incomplete even if other fields are fine", () => {
    expect(
      prosbaLineHasSubmitBlockers(teethLine, "zamowienie", teethExempt),
    ).toBe(true);
  });

  it("returns false when all fields and teeth details are complete", () => {
    expect(
      prosbaLineHasSubmitBlockers(
        {
          ...teethLine,
          teethManufacturer: "wiedent",
          teethProductLine: "wiedent_estetic",
          teethDetails: [{ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }],
        },
        "zamowienie",
        teethExempt,
      ),
    ).toBe(false);
  });
});
