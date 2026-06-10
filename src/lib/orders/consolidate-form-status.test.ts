import { describe, expect, it } from "vitest";
import {
  consolidateSubiektFeedbacks,
  dedupeSubiektFeedbacks,
  shouldSuppressCompletenessBanner,
  subiektFeedbackBody,
} from "@/lib/orders/consolidate-form-status";
import { getSubiektFeedback } from "@/lib/subiekt/feedback";

describe("consolidate-form-status", () => {
  it("dedupes identical feedbacks", () => {
    const f = getSubiektFeedback("timeout");
    expect(dedupeSubiektFeedbacks([f, f])).toHaveLength(1);
  });

  it("hides search noise when Subiekt is unavailable", () => {
    const unavailable = getSubiektFeedback("subiekt_unavailable");
    const searchMiss = getSubiektFeedback("not_found_supplier");
    const out = consolidateSubiektFeedbacks([searchMiss, unavailable]);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("subiekt_unavailable");
  });

  it("zachowuje brak mapowania dostawcy gdy Subiekt niedostępny", () => {
    const unavailable = getSubiektFeedback("subiekt_unavailable");
    const mapping = getSubiektFeedback("catalog_supplier_unmapped", {
      message: "Brak przypisanego dostawcy w naszej bazie dla tego towaru.",
    });
    const out = consolidateSubiektFeedbacks([mapping, unavailable]);
    expect(out).toHaveLength(2);
    expect(out.some((f) => f.code === "catalog_supplier_unmapped")).toBe(true);
    expect(out.some((f) => f.code === "subiekt_unavailable")).toBe(true);
  });

  it("merges redundant hint into message body once", () => {
    const body = subiektFeedbackBody({
      ...getSubiektFeedback("not_configured"),
      message: "Integracja nie jest skonfigurowana lub jest poza siecią firmową.",
      hint: "Integracja nie jest skonfigurowana.",
    });
    expect(body).toBe("Integracja nie jest skonfigurowana lub jest poza siecią firmową.");
  });

  it("appends hint when it adds new guidance", () => {
    const f = getSubiektFeedback("not_found_supplier");
    const body = subiektFeedbackBody(f);
    expect(body.length).toBeGreaterThan(f.message.length);
  });

  it("ukrywa kompletność gdy Subiekt już prosi tylko o dostawcę", () => {
    const mapping = getSubiektFeedback("catalog_supplier_unmapped");
    const draft = {
      supplierId: "",
      product: "Aplodent Cold",
      quantity: "1",
      requestKind: "zamowienie" as const,
    };
    expect(shouldSuppressCompletenessBanner([mapping], draft)).toBe(true);
  });

  it("nie ukrywa kompletności gdy brakuje też produktu", () => {
    const mapping = getSubiektFeedback("catalog_supplier_unmapped");
    const draft = {
      supplierId: "",
      product: "",
      quantity: "1",
      requestKind: "zamowienie" as const,
    };
    expect(shouldSuppressCompletenessBanner([mapping], draft)).toBe(false);
  });
});
