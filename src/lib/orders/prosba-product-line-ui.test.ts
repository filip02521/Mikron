import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  formatProsbaLineSummary,
  focusLineIdAfterTeethSave,
  isProsbaLineFromSubiekt,
  isProsbaLineReady,
  shouldCollapseProsbaLine,
} from "./prosba-product-line-ui";

const baseLine: ProductLineDraft = {
  id: "a",
  symbol: "",
  mikranCode: "",
  product: "",
  quantity: "",
};

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

describe("shouldCollapseProsbaLine", () => {
  it("nie zwija jedynej pozycji", () => {
    const line = { ...baseLine, product: "X", quantity: "1", subiektTwId: 1 };
    expect(shouldCollapseProsbaLine(line, "zamowienie", 1, "a")).toBe(false);
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
  it("zwija zapisane pozycje gdy wszystkie gotowe", () => {
    const lines = [
      { ...baseLine, id: "1", product: "Przednie", quantity: "4", subiektTwId: 1, teethDetails: [{} as never] },
      { ...baseLine, id: "2", product: "Boczne", quantity: "8", subiektTwId: 2, teethDetails: [{} as never] },
    ];
    expect(focusLineIdAfterTeethSave(lines, ["1", "2"], "zamowienie")).toBeNull();
  });

  it("zostawia rozwiniętą niegotową pozycję", () => {
    const ready = { ...baseLine, id: "1", product: "A", quantity: "1", subiektTwId: 1 };
    const draft = { ...baseLine, id: "2", product: "" };
    expect(focusLineIdAfterTeethSave([ready, draft], ["1"], "zamowienie")).toBe("2");
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
