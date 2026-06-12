import { describe, expect, it } from "vitest";
import { roleBadgeClass } from "@/lib/ui/ontime-theme";

describe("roleBadgeClass", () => {
  it("maps magazyn to emerald tint without left bar", () => {
    expect(roleBadgeClass("magazyn")).toContain("bg-emerald-50");
    expect(roleBadgeClass("magazyn")).not.toContain("border-l-");
  });

  it("falls back for unknown roles", () => {
    expect(roleBadgeClass("unknown")).toContain("bg-slate-50");
    expect(roleBadgeClass("unknown")).not.toContain("border-l-");
  });
});
