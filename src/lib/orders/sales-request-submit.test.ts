import { describe, expect, it } from "vitest";
import {
  assessSalesGroupSubmittable,
  planSalesRequestSubmit,
  salesSubmitUserHint,
} from "./sales-request-submit";

describe("planSalesRequestSubmit", () => {
  it("pozwala wysłać bez dostawcy (do weryfikacji)", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 42,
    });
    expect(plan.submittable).toBe(true);
    expect(plan.initialStatus).toBe("Weryfikacja");
    expect(plan.bannerKind).toBe("incomplete");
  });

  it("z dostawcą od razu trafia do Nowe", () => {
    const plan = planSalesRequestSubmit({
      supplierId: "sup-1",
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 42,
    });
    expect(plan.initialStatus).toBe("Nowe");
  });
});

describe("assessSalesGroupSubmittable", () => {
  it("łączy wiele linii (submittable)", () => {
    const plan = assessSalesGroupSubmittable(
      [
        { symbol: "A", product: "P1", quantity: "1", subiektTwId: 1 },
        { symbol: "B", product: "P2", quantity: "2", subiektTwId: 2 },
      ],
      "",
      "zamowienie"
    );
    expect(plan?.submittable).toBe(true);
  });
});

describe("salesSubmitUserHint", () => {
  it("submittable incomplete — można wysłać, info", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
    });
    const hint = salesSubmitUserHint(plan, "zamowienie");
    expect(hint?.tone).toBe("info");
    expect(hint?.title).toContain("Możesz wysłać");
  });

  it("blocked incomplete — ostrzeżenie przed wysłaniem", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "",
      requestKind: "zamowienie",
    });
    const hint = salesSubmitUserHint(plan, "zamowienie");
    expect(hint?.tone).toBe("warning");
    expect(hint?.title).toContain("przed wysłaniem");
  });

  // Brak osobnego trybu "pending_supplier" — auto-dopasowanie dostawcy z Subiekta jest wycofane.
});
