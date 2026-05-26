import { describe, expect, it } from "vitest";
import {
  assessSalesGroupSubmittable,
  planSalesRequestSubmit,
  salesSubmitUserHint,
} from "./sales-request-submit";

describe("planSalesRequestSubmit", () => {
  it("pozwala wysłać z towarem Subiekt bez dostawcy — pending w tle", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 42,
    });
    expect(plan.submittable).toBe(true);
    expect(plan.supplierResolvePending).toBe(true);
    expect(plan.initialStatus).toBe("Weryfikacja");
    expect(plan.bannerKind).toBe("pending_supplier");
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
    expect(plan.supplierResolvePending).toBe(false);
  });
});

describe("assessSalesGroupSubmittable", () => {
  it("łączy wiele linii z pending", () => {
    const plan = assessSalesGroupSubmittable(
      [
        { symbol: "A", product: "P1", quantity: "1", subiektTwId: 1 },
        { symbol: "B", product: "P2", quantity: "2", subiektTwId: 2 },
      ],
      "",
      "zamowienie"
    );
    expect(plan?.bannerKind).toBe("pending_supplier");
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

  it("pending supplier — gotowe do wysłania", () => {
    const plan = planSalesRequestSubmit({
      symbol: "ABC",
      product: "Test",
      quantity: "1",
      requestKind: "zamowienie",
      subiektTwId: 1,
    });
    const hint = salesSubmitUserHint(plan, "zamowienie");
    expect(hint?.tone).toBe("success");
    expect(hint?.title).toContain("Gotowe");
  });
});
