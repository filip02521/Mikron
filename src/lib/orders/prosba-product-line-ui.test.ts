import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  formatProsbaLineSummary,
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
