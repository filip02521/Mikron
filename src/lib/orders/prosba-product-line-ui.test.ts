import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import {
  canCollapseProsbaLine,
  formatProsbaLineSummary,
  focusLineIdAfterTeethSave,
  isProsbaLineFromSubiekt,
  isProsbaLineReady,
  shouldCollapseProsbaLine,
} from "./prosba-product-line-ui";
import { prosbaLineHasSubmitBlockers } from "./prosba-line-field-validation";

const baseLine: ProductLineDraft = {
  id: "a",
  symbol: "",
  mikranCode: "",
  product: "",
  quantity: "",
};

const readyNonTeeth: ProductLineDraft = {
  ...baseLine,
  id: "1",
  product: "A",
  quantity: "1",
  subiektTwId: 1,
};

const incompleteTeethDetail = {
  position: 1,
  color: "A1",
  mould: null,
  jaw: "upper",
  kind: "anterior",
} as TeethLineDetail;

const completeTeethDetail = {
  position: 1,
  color: "A1",
  mould: "A11",
  jaw: "upper",
  kind: "anterior",
} as TeethLineDetail;

const completeTeethLine = (id: string, twId: number): ProductLineDraft => ({
  ...baseLine,
  id,
  product: "Ząb",
  quantity: "1",
  subiektTwId: twId,
  teethManufacturer: "ivoclar",
  teethProductLine: "ivoclar_vivodent_dcl",
  teethKind: "anterior",
  teethDetails: [completeTeethDetail],
});

describe("isProsbaLineReady", () => {
  it("gotowa po wyborze z Subiekta z ilością", () => {
    expect(
      isProsbaLineReady(
        {
          ...baseLine,
          product: "Wkręt",
          symbol: "ABC",
          quantity: "2",
          subiektTwId: 99,
        },
        "zamowienie"
      )
    ).toBe(true);
  });

  it("niegotowa bez ilości przy zamówieniu", () => {
    expect(
      isProsbaLineReady(
        { ...baseLine, product: "Opis", subiektTwId: 1 },
        "zamowienie"
      )
    ).toBe(false);
  });
});

describe("canCollapseProsbaLine", () => {
  it("zwija gotowy produkt bez zębów", () => {
    expect(canCollapseProsbaLine(readyNonTeeth, "zamowienie")).toBe(true);
  });

  it("nie zwija linii zębowej ze szkicem (exempt)", () => {
    const teethLine: ProductLineDraft = {
      ...readyNonTeeth,
      subiektTwId: 50,
      teethManufacturer: "ivoclar",
      teethProductLine: "ivoclar_vivodent_dcl",
      teethKind: "anterior",
      quantity: "1",
      teethDetails: [incompleteTeethDetail],
    };
    expect(
      canCollapseProsbaLine(teethLine, "zamowienie", { exemptTwIds: new Set([50]) }),
    ).toBe(false);
  });

  it("nie zwija szkicu gdy jest tylko teethManufacturer (bez exempt)", () => {
    const teethLine: ProductLineDraft = {
      ...readyNonTeeth,
      subiektTwId: 50,
      teethManufacturer: "ivoclar",
      teethProductLine: "ivoclar_vivodent_dcl",
      quantity: "1",
      teethDetails: [incompleteTeethDetail],
    };
    expect(canCollapseProsbaLine(teethLine, "zamowienie", { exemptTwIds: new Set() })).toBe(
      false,
    );
  });

  it("nie zwija linii zębowej gdy katalog niedostępny", () => {
    const teethLine = completeTeethLine("1", 50);
    expect(
      canCollapseProsbaLine(teethLine, "zamowienie", {
        exemptTwIds: new Set([50]),
        catalogAvailable: false,
      }),
    ).toBe(false);
  });

  it("zwija linię zębową z kompletną listą", () => {
    const teethLine = completeTeethLine("1", 50);
    expect(
      canCollapseProsbaLine(teethLine, "zamowienie", { exemptTwIds: new Set([50]) }),
    ).toBe(true);
  });
});

describe("shouldCollapseProsbaLine", () => {
  it("zwija gotową jedyną pozycję w trybie przeglądu", () => {
    expect(shouldCollapseProsbaLine(readyNonTeeth, "zamowienie", 1, "")).toBe(true);
  });

  it("nie zwija aktywnej jedynej pozycji", () => {
    expect(shouldCollapseProsbaLine(readyNonTeeth, "zamowienie", 1, "1")).toBe(false);
  });

  it("nie zwija szkicu zębów nawet przy wielu liniach", () => {
    const teethDraft: ProductLineDraft = {
      ...readyNonTeeth,
      id: "t",
      subiektTwId: 50,
      teethManufacturer: "ivoclar",
      teethProductLine: "ivoclar_vivodent_dcl",
      quantity: "1",
      teethDetails: [incompleteTeethDetail],
    };
    expect(
      shouldCollapseProsbaLine(teethDraft, "zamowienie", 2, "other", {
        exemptTwIds: new Set([50]),
      }),
    ).toBe(false);
  });

  it("zwija gotową pozycję gdy edytowana jest inna", () => {
    const ready = { ...baseLine, id: "1", product: "A", quantity: "1", subiektTwId: 1 };
    const active = { ...baseLine, id: "2" };
    expect(shouldCollapseProsbaLine(ready, "zamowienie", 2, active.id)).toBe(true);
    expect(shouldCollapseProsbaLine(active, "zamowienie", 2, active.id)).toBe(false);
  });

  it("zwija wszystkie gotowe pozycje gdy brak aktywnej linii", () => {
    const readyA = { ...baseLine, id: "1", product: "A", quantity: "1", subiektTwId: 1 };
    const readyB = { ...baseLine, id: "2", product: "B", quantity: "2", subiektTwId: 2 };
    expect(shouldCollapseProsbaLine(readyA, "zamowienie", 2, "")).toBe(true);
    expect(shouldCollapseProsbaLine(readyB, "zamowienie", 2, "")).toBe(true);
  });
});

describe("focusLineIdAfterTeethSave", () => {
  it("zwija do podsumowania gdy wszystkie gotowe (także jedna linia)", () => {
    const complete = completeTeethLine("1", 50);
    expect(
      focusLineIdAfterTeethSave([complete], ["1"], "zamowienie", {
        exemptTwIds: new Set([50]),
      }),
    ).toBeNull();
  });

  it("zwija zapisane pozycje gdy wszystkie gotowe (multi)", () => {
    const lines = [
      completeTeethLine("1", 50),
      {
        ...completeTeethLine("2", 51),
        product: "Boczne",
        teethKind: "posterior" as const,
        teethDetails: [{ ...completeTeethDetail, kind: "posterior" as const }],
      },
    ];
    expect(
      focusLineIdAfterTeethSave(lines, ["1", "2"], "zamowienie", {
        exemptTwIds: new Set([50, 51]),
      }),
    ).toBeNull();
  });

  it("zostawia rozwiniętą niegotową pozycję", () => {
    const ready = { ...baseLine, id: "1", product: "A", quantity: "1", subiektTwId: 1 };
    const draft = { ...baseLine, id: "2", product: "" };
    expect(focusLineIdAfterTeethSave([ready, draft], ["1"], "zamowienie")).toBe("2");
  });

  it("zostawia fokus na niezapisanej linii ze szkicem zębów", () => {
    const savedComplete = completeTeethLine("1", 50);
    const draft: ProductLineDraft = {
      ...completeTeethLine("2", 51),
      teethDetails: [incompleteTeethDetail],
    };
    expect(
      focusLineIdAfterTeethSave([savedComplete, draft], ["1"], "zamowienie", {
        exemptTwIds: new Set([50, 51]),
      }),
    ).toBe("2");
  });
});

describe("validation / collapse edge cases", () => {
  it("teeth-only blocker (exempt + brak listy) blokuje submit i collapse", () => {
    const line: ProductLineDraft = {
      ...readyNonTeeth,
      subiektTwId: 50,
      teethManufacturer: "ivoclar",
      teethProductLine: "ivoclar_vivodent_dcl",
      quantity: "1",
      teethDetails: undefined,
    };
    const opts = { exemptTwIds: new Set([50]) };
    expect(prosbaLineHasSubmitBlockers(line, "zamowienie", opts)).toBe(true);
    expect(canCollapseProsbaLine(line, "zamowienie", opts)).toBe(false);
  });

  it("szkic z producentem nie zwija się nawet bez exempt (fail-closed collapse)", () => {
    const line: ProductLineDraft = {
      ...readyNonTeeth,
      subiektTwId: 50,
      teethManufacturer: "ivoclar",
      teethProductLine: "ivoclar_vivodent_dcl",
      quantity: "1",
      teethDetails: [incompleteTeethDetail],
    };
    expect(canCollapseProsbaLine(line, "zamowienie", { exemptTwIds: new Set() })).toBe(false);
  });
});

describe("formatProsbaLineSummary", () => {
  it("pokazuje symbol i kod Mikran", () => {
    const s = formatProsbaLineSummary(
      {
        ...baseLine,
        product: "MiYO Fluor",
        symbol: "896",
        mikranCode: "896",
        quantity: "3",
        subiektTwId: 12,
      },
      "zamowienie"
    );
    expect(s.title).toBe("MiYO Fluor");
    expect(s.meta).toContain("896");
    expect(s.meta).toContain("Subiekt");
    expect(s.quantityLabel).toBe("3 szt.");
    expect(isProsbaLineFromSubiekt({ ...baseLine, subiektTwId: 12 })).toBe(true);
  });
});
