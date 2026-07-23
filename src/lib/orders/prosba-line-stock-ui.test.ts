import { describe, expect, it } from "vitest";
import {
  buildProsbaLineStockStatusView,
  buildProsbaSufficientStockSummary,
  formatProsbaStockLineHint,
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

  it("wystarczający stan — ton amber", () => {
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

  it("częściowy stan — ton sky", () => {
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
    expect(view?.title).toContain("Częściowy");
  });

  it("brak stanu — ton slate", () => {
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

  it("wystarczający stan z rezerwacją — pokazuje rezerwację w detail i shortLabel", () => {
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
    expect(view?.detail).toContain("rezerwacja 3 szt.");
    expect(view?.detail).toContain("na stanie 10 szt.");
    expect(view?.shortLabel).toContain("−3 rez.");
  });

  it("częściowy stan z rezerwacją — pokazuje rezerwację w detail i shortLabel", () => {
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
    expect(view?.detail).toContain("rezerwacja 2 szt.");
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
    expect(hint).toContain("3 szt.");
    expect(hint).toContain("Wystarczający stan magazynowy");
  });
});
