import { describe, expect, it } from "vitest";
import { roleBadgeClass } from "@/lib/ui/ontime-theme";

describe("roleBadgeClass", () => {
  it("maps magazyn to emerald accent", () => {
    expect(roleBadgeClass("magazyn")).toContain("border-l-emerald-500");
  });

  it("falls back for unknown roles", () => {
    expect(roleBadgeClass("unknown")).toContain("border-l-slate-400");
  });
});
