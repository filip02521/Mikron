import { describe, expect, it } from "vitest";
import { buildProsbaFormReadiness } from "./prosba-form-readiness";
import { planSalesRequestSubmit } from "./sales-request-submit";

describe("buildProsbaFormReadiness", () => {
  it("pusty formularz — neutralny stan", () => {
    const view = buildProsbaFormReadiness([], "zamowienie", null);
    expect(view.tone).toBe("neutral");
    expect(view.canSubmit).toBe(false);
    expect(view.steps.find((s) => s.id === "product")?.state).toBe("empty");
  });

  it("produkt bez ilości — blocked", () => {
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Test",
      quantity: "",
      requestKind: "zamowienie",
    });
    const view = buildProsbaFormReadiness(
      [{ symbol: "A", product: "Test", quantity: "" }],
      "zamowienie",
      plan
    );
    expect(view.tone).toBe("blocked");
    expect(view.steps.find((s) => s.id === "quantity")?.state).toBe("action");
  });

  it("subiekt bez dostawcy — ready + handoff na dostawcy", () => {
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Test",
      quantity: "1",
      subiektTwId: 9,
      requestKind: "zamowienie",
    });
    const view = buildProsbaFormReadiness(
      [{ symbol: "A", product: "Test", quantity: "1", subiektTwId: 9 }],
      "zamowienie",
      plan
    );
    expect(view.tone).toBe("handoff");
    expect(view.canSubmit).toBe(true);
    expect(view.steps.find((s) => s.id === "supplier")?.state).toBe("handoff");
    expect(view.steps.find((s) => s.id === "supplier")?.detail).toContain("dopasuje dział zakupów");
  });

  it("subiekt z dopasowanym dostawcą — done", () => {
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Test",
      quantity: "1",
      subiektTwId: 9,
      supplierId: "sup-1",
      requestKind: "zamowienie",
    });
    const view = buildProsbaFormReadiness(
      [
        {
          symbol: "A",
          product: "Test",
          quantity: "1",
          subiektTwId: 9,
          supplierId: "sup-1",
        },
      ],
      "zamowienie",
      plan
    );
    expect(view.steps.find((s) => s.id === "supplier")?.state).toBe("done");
    expect(view.steps.find((s) => s.id === "supplier")?.detail).toContain("panelu dziennego");
  });

  it("zęby z dopasowanym dostawcą — panel zębów", () => {
    const exempt = new Set([42]);
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Zęby",
      quantity: "1",
      subiektTwId: 42,
      supplierId: "sup-1",
      requestKind: "zamowienie",
    });
    const view = buildProsbaFormReadiness(
      [
        {
          symbol: "A",
          product: "Zęby",
          quantity: "1",
          subiektTwId: 42,
          supplierId: "sup-1",
          teethDetails: [
            { position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" },
          ],
        },
      ],
      "zamowienie",
      plan,
      { teethExemptTwIds: exempt }
    );
    expect(view.steps.find((s) => s.id === "supplier")?.detail).toContain("panelu zębów");
    expect(view.subline).toContain("panelu zębów");
  });

  it("mieszane tory zęby + towar — ostrzeżenie przed wysłaniem", () => {
    const exempt = new Set([42]);
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Zęby",
      quantity: "1",
      subiektTwId: 42,
      supplierId: "sup-1",
      requestKind: "zamowienie",
    });
    const view = buildProsbaFormReadiness(
      [
        {
          symbol: "A",
          product: "Zęby",
          quantity: "1",
          subiektTwId: 42,
          supplierId: "sup-1",
          teethDetails: [
            { position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" },
          ],
        },
        {
          symbol: "B",
          product: "Towar",
          quantity: "2",
          subiektTwId: 99,
          supplierId: "sup-2",
        },
      ],
      "zamowienie",
      plan,
      { teethExemptTwIds: exempt }
    );
    expect(view.headline).toContain("dwa tory");
    expect(view.subline).toContain("panelu zębów");
  });

  it("informacja stock out — ścieżka w checklistie", () => {
    const plan = planSalesRequestSubmit({
      symbol: "A",
      product: "Test",
      requestKind: "informacja",
    });
    const view = buildProsbaFormReadiness(
      [{ symbol: "A", product: "Test" }],
      "informacja",
      plan,
      { informacjaPath: "stock_out" }
    );
    expect(view.steps.find((s) => s.id === "path")?.detail).toContain("Brak na stanie");
    expect(view.subline).toContain("Moje zamówienia");
  });
});
