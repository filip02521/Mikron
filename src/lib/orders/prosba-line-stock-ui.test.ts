import { describe, expect, it } from "vitest";
import {
  buildProsbaLineStockStatusView,
  buildProsbaSufficientStockSummary,
  formatProsbaStockLineHint,
  prosbaPairStockNote,
} from "./prosba-line-stock-ui";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";

function line(partial: Partial<ProductLineDraft> = {}): ProductLineDraft {
  return {
    id: "l1",
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
    ...partial,
  };
}

describe("buildProsbaLineStockStatusView", () => {
  it("zwraca null dla informacji", () => {
    expect(
      buildProsbaLineStockStatusView(
        line({ stockSource: "subiekt", available: 5, quantity: "2" }),
        "informacja"
      )
    ).toBeNull();
  });

  it("wystarczający stan - ton amber", () => {
    const view = buildProsbaLineStockStatusView(
      line({
        stockSource: "subiekt",
        onHand: 10,
        reserved: 0,
        available: 10,
        quantity: "3",
      }),
      "zamowienie"
    );
    expect(view?.assessment).toBe("sufficient");
    expect(view?.tone).toBe("amber");
    expect(view?.shortLabel).toContain("10 szt.");
  });

  it("towar z opakowaniem zbiorczym: zdanie dla handlowca zamiast „cover pary”", () => {
    const view = buildProsbaLineStockStatusView(
      line({ stockSource: "subiekt", onHand: 45, reserved: 0, available: 45, quantity: "2", pairStockCover: true, pairUnitsPerPack: 5, pairRole: "piece" }),
      "zamowienie"
    );
    expect(view?.title).toBe("Wystarczy z półki");
    expect(view?.shortLabel).toBe("Na stanie 45 szt.");
    expect(view?.detail).toBe("Liczymy też opakowania zbiorcze (1 op. = 5 szt.) - magazyn je rozpakuje.");
    expect(`${view?.title} ${view?.detail} ${view?.shortLabel}`).not.toMatch(/cover|para|demonta/i);
  });

  it("zdanie o parze dla opakowania i bez znanej roli", () => {
    expect(prosbaPairStockNote("pack", 5)).toBe("Liczymy też pojedyncze sztuki: 5 szt. zastępuje 1 op.");
    expect(prosbaPairStockNote(null, 5)).toBe("Liczymy razem sztuki i opakowania zbiorcze (1 op. = 5 szt.).");
    expect(prosbaPairStockNote("piece", null)).toBe("Liczymy też opakowania zbiorcze - magazyn je rozpakuje.");
  });

  it("częściowy stan - ton sky", () => {
    const view = buildProsbaLineStockStatusView(
      line({
        stockSource: "subiekt",
        onHand: 2,
        reserved: 0,
        available: 2,
        quantity: "5",
      }),
      "zamowienie"
    );
    expect(view?.assessment).toBe("insufficient");
    expect(view?.tone).toBe("sky");
    expect(view?.title).toBe("Za mało z półki");
  });

  it("brak stanu - ton slate", () => {
    const view = buildProsbaLineStockStatusView(
      line({
        stockSource: "subiekt",
        onHand: 0,
        reserved: 0,
        available: 0,
        quantity: "1",
      }),
      "zamowienie"
    );
    expect(view?.assessment).toBe("unavailable");
    expect(view?.tone).toBe("slate");
  });

  it("wystarczający stan z rezerwacją - pokazuje rezerwację w detail i shortLabel", () => {
    const view = buildProsbaLineStockStatusView(
      line({
        stockSource: "subiekt",
        onHand: 10,
        reserved: 3,
        available: 7,
        quantity: "5",
      }),
      "zamowienie"
    );
    expect(view?.assessment).toBe("sufficient");
    expect(view?.title).toBe("Wystarczy z półki");
    expect(view?.detail).toContain("7 szt.");
    expect(view?.detail).toContain("−3 rez.");
    expect(view?.shortLabel).toContain("−3 rez.");
  });

  it("częściowy stan z rezerwacją - rezerwacja w shortLabel i detail", () => {
    const view = buildProsbaLineStockStatusView(
      line({
        stockSource: "subiekt",
        onHand: 5,
        reserved: 2,
        available: 3,
        quantity: "10",
      }),
      "zamowienie"
    );
    expect(view?.assessment).toBe("insufficient");
    expect(view?.title).toBe("Za mało z półki");
    expect(view?.detail).toContain("3 szt.");
    expect(view?.shortLabel).toContain("−2 rez.");
  });
});

describe("buildProsbaSufficientStockSummary", () => {
  it("odmienia pozycja / pozycje / pozycji", () => {
    expect(buildProsbaSufficientStockSummary(1)?.title).toContain("1 pozycja");
    expect(buildProsbaSufficientStockSummary(2)?.title).toContain("2 pozycje");
    expect(buildProsbaSufficientStockSummary(5)?.title).toContain("5 pozycji");
    expect(buildProsbaSufficientStockSummary(22)?.title).toContain("22 pozycje");
  });
});

describe("formatProsbaStockLineHint", () => {
  it("zawiera tytuł, ilość i dostępny stan", () => {
    const hint = formatProsbaStockLineHint({
      product: "Wkręt",
      symbol: "W1",
      quantity: "3",
      available: 10,
    });
    expect(hint).toContain("10 szt.");
    expect(hint).toContain("Wystarczy z półki");
  });
});
