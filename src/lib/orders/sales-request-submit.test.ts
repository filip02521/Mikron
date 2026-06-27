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

  it("produkt z bazy offline z dostawcą trafia od razu do Nowe", () => {
    const plan = planSalesRequestSubmit({
      supplierId: "sup-1",
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 42,
      source: "catalog",
    });
    expect(plan.initialStatus).toBe("Nowe");
    expect(plan.bannerKind).toBe("complete");
  });

  it("produkt z bazy offline bez dostawcy trafia do Weryfikacji", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 42,
      source: "catalog",
    });
    expect(plan.initialStatus).toBe("Weryfikacja");
    expect(plan.bannerKind).toBe("incomplete");
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

  it("catalog z dostawcą w grupie — status Nowe", () => {
    const plan = assessSalesGroupSubmittable(
      [
        {
          symbol: "A",
          product: "P1",
          quantity: "1",
          subiektTwId: 1,
          source: "catalog",
        },
      ],
      "sup-1",
      "zamowienie"
    );
    expect(plan?.initialStatus).toBe("Nowe");
    expect(plan?.bannerKind).toBe("complete");
  });

  it("catalog bez dostawcy w grupie — status Weryfikacja", () => {
    const plan = assessSalesGroupSubmittable(
      [
        {
          symbol: "A",
          product: "P1",
          quantity: "1",
          subiektTwId: 1,
          source: "catalog",
        },
      ],
      "",
      "zamowienie"
    );
    expect(plan?.initialStatus).toBe("Weryfikacja");
    expect(plan?.bannerKind).toBe("incomplete");
  });

  it("informacja z catalog i dostawcą — status Nowe", () => {
    const plan = assessSalesGroupSubmittable(
      [
        {
          symbol: "A",
          product: "P1",
          quantity: "",
          subiektTwId: 1,
          source: "catalog",
        },
      ],
      "sup-1",
      "informacja"
    );
    expect(plan?.initialStatus).toBe("Nowe");
    expect(plan?.bannerKind).toBe("complete");
  });

  it("mieszane linie catalog + subiekt z dostawcą — complete", () => {
    const plan = assessSalesGroupSubmittable(
      [
        {
          symbol: "A",
          product: "P1",
          quantity: "1",
          subiektTwId: 1,
          source: "catalog",
        },
        {
          symbol: "B",
          product: "P2",
          quantity: "2",
          subiektTwId: 2,
          source: "subiekt",
        },
      ],
      "sup-1",
      "zamowienie"
    );
    expect(plan?.initialStatus).toBe("Nowe");
    expect(plan?.bannerKind).toBe("complete");
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
