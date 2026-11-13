import { describe, expect, it } from "vitest";
import { zdEstimateRunNoticeCopy } from "./zd-estimate-run-notice-copy";

describe("zdEstimateRunNoticeCopy", () => {
  it("liczenie: strony z Subiekta i czas", () => {
    const c = zdEstimateRunNoticeCopy({ state: "running", label: " Ivoclar ", elapsedMs: 42_000, pagesCommitted: 3, totalPages: 9 });
    expect(c.subject).toBe("Ivoclar");
    expect(c.detail).toContain("strona 3 z 9");
    expect(c.detail).toContain("Trwa 42s");
  });

  it("liczenie bez znanych stron nie zmyśla postępu", () => {
    expect(zdEstimateRunNoticeCopy({ state: "running", label: "" }).detail).not.toContain("strona");
  });

  it("gotowe i błąd", () => {
    expect(zdEstimateRunNoticeCopy({ state: "ready", label: "X" }).primaryCta).toBe("Otwórz listę");
    expect(zdEstimateRunNoticeCopy({ state: "failed", label: "X", message: "Brak sieci." }).detail).toBe("Brak sieci.");
  });
});
