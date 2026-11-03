import { describe, expect, it } from "vitest";
import { canAccessPath, canAccessServicePanel, homePathForRole } from "@/lib/auth-roles";
import { navForRole } from "@/lib/nav";
import { roleRequiresSalesPerson } from "@/lib/users/labels";

describe("rola serwis", () => {
  it("startuje w panelu serwisu i widzi tylko jego ścieżki", () => {
    expect(homePathForRole("serwis")).toBe("/serwis");
    expect(canAccessPath("serwis", "/serwis")).toBe(true);
    expect(canAccessPath("serwis", "/ustawienia")).toBe(true);
    expect(canAccessPath("serwis", "/zakupy/szacunek")).toBe(false);
    expect(canAccessPath("serwis", "/kolejka")).toBe(false);
    expect(canAccessPath("serwis", "/prosba")).toBe(false);
    expect(canAccessPath("serwis", "/admin")).toBe(false);
  });

  it("panel serwisu: serwis, magazyn, zakupy, admin — bez handlowców", () => {
    for (const role of ["serwis", "magazyn", "zakupy", "admin"] as const) {
      expect(canAccessServicePanel(role)).toBe(true);
    }
    expect(canAccessServicePanel("sales")).toBe(false);
    expect(canAccessServicePanel("sales_manager")).toBe(false);
  });

  it("ma własne menu i kartę handlowca", () => {
    const hrefs = navForRole("serwis").flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(["/serwis"]);
    expect(roleRequiresSalesPerson("serwis")).toBe(true);
  });
});
