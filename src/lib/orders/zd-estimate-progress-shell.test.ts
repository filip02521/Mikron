import { describe, expect, it } from "vitest";
import { shouldUseZdEstimateProgressShell } from "./zd-estimate-progress-shell";

describe("shouldUseZdEstimateProgressShell", () => {
  it("pierwsze Policz (brak listy) → panel postępu", () => {
    expect(shouldUseZdEstimateProgressShell({ hasLines: false })).toBe(true);
  });

  it("re-Policz (lista jest) → overlay, nie panel", () => {
    expect(shouldUseZdEstimateProgressShell({ hasLines: true })).toBe(false);
  });
});
