import { describe, expect, it } from "vitest";
import {
  assessProcurementGroupCompleteness,
  buildProcurementFormReadiness,
} from "./procurement-form-readiness";

describe("procurement-form-readiness", () => {
  it("wymaga handlowca, dostawcy i produktu", () => {
    const view = buildProcurementFormReadiness({
      salesPersonId: "",
      supplierId: "s1",
      requestKind: "zamowienie",
      lines: [{ symbol: "A", mikranCode: "", product: "", quantity: "1" }],
    });
    expect(view.canSubmit).toBe(false);
    expect(view.steps.find((s) => s.id === "sales")?.state).toBe("empty");
  });

  it("kompletne zgłoszenie można wysłać", () => {
    const view = buildProcurementFormReadiness({
      salesPersonId: "p1",
      supplierId: "s1",
      requestKind: "zamowienie",
      lines: [{ symbol: "A", mikranCode: "", product: "", quantity: "2" }],
    });
    expect(view.canSubmit).toBe(true);
    expect(assessProcurementGroupCompleteness(
      [{ symbol: "A", mikranCode: "", product: "", quantity: "2" }],
      "s1",
      "zamowienie"
    )).toBe("complete");
  });
});
