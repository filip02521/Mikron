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
    expect(view.tone).toBe("ready");
    expect(view.canSubmit).toBe(true);
    expect(view.steps.find((s) => s.id === "supplier")?.state).toBe("done");
    expect(view.steps.find((s) => s.id === "supplier")?.detail).toContain("Subiekta");
  });
});
