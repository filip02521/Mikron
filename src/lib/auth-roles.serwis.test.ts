import { describe, expect, it } from "vitest";
import { canAccessPath, canAccessServicePanel, homePathForRole } from "@/lib/auth-roles";
import { navForRole } from "@/lib/nav";
import { roleRequiresSalesPerson } from "@/lib/users/labels";

describe("rola serwis", () => {
  it("startuje w panelu serwisu i widzi tylko jego ścieżki", () => {
    expect(homePathForRole("serwis")).toBe("/serwis/zlecenia");
    expect(canAccessPath("serwis", "/serwis/zlecenia")).toBe(true);
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
    expect(hrefs).toEqual(["/serwis/zlecenia", "/serwis", "/serwis/zamienniki", "/serwis/modele"]);
    expect(roleRequiresSalesPerson("serwis")).toBe(true);
  });
});

describe("menu serwisu", () => {
  it("pozycja świeci na każdej zakładce hubu, a nie poza nim", async () => {
    const { isNavItemActive } = await import("@/lib/nav");
    for (const p of ["/serwis", "/serwis/zlecenia", "/serwis/zamienniki", "/serwis/modele"]) {
      expect(isNavItemActive(p, "/serwis/zlecenia")).toBe(true);
      expect(isNavItemActive(p, "/serwis")).toBe(true);
    }
    expect(isNavItemActive("/serwisy", "/serwis")).toBe(false);
    expect(isNavItemActive("/zakupy/szacunek", "/serwis")).toBe(false);
  });
});
