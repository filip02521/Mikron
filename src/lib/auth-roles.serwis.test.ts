import { describe, expect, it } from "vitest";
import { canAccessPath, canAccessServicePanel, homePathForRole } from "@/lib/auth-roles";
import { navForRole } from "@/lib/nav";
import { effectiveNavRole, homePathForAdminPanelContext, isAdminOperationsPreviewReadOnly } from "@/lib/auth/admin-panel-context";
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

  it("panel serwisu: tylko serwisant; admin przez podgląd „Serwis”", () => {
    expect(canAccessServicePanel("serwis")).toBe(true);
    expect(canAccessServicePanel("admin")).toBe(true);
    for (const role of ["magazyn", "zakupy", "zakupy_zeby", "sales", "sales_manager"] as const) {
      expect(canAccessServicePanel(role)).toBe(false);
      expect(canAccessPath(role, "/serwis/zlecenia")).toBe(false);
      expect(canAccessPath(role, "/serwis")).toBe(false);
    }
    // Magazyn z przypisanym obszarem też nie — obszary nie dają serwisu.
    expect(canAccessPath("zakupy", "/serwis/zlecenia", { workspaces: ["dostawy", "magazyn"] })).toBe(false);
    // Admin: bez podglądu przekierowanie, w podglądzie „Serwis” — cały panel, home = zlecenia.
    expect(canAccessPath("admin", "/serwis/zlecenia")).toBe(false);
    expect(canAccessPath("admin", "/serwis/zlecenia", { adminPanelContext: "serwis" })).toBe(true);
    expect(canAccessPath("admin", "/serwis/modele", { adminPanelContext: "serwis" })).toBe(true);
    expect(canAccessPath("admin", "/kolejka", { adminPanelContext: "serwis" })).toBe(false);
    expect(homePathForAdminPanelContext("serwis")).toBe("/serwis/zlecenia");
    expect(effectiveNavRole("admin", "serwis")).toBe("serwis");
    expect(isAdminOperationsPreviewReadOnly("admin", "serwis")).toBe(true);
  });

  it("ma własne menu i kartę handlowca", () => {
    const hrefs = navForRole("serwis").flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(["/serwis/zlecenia", "/serwis", "/serwis/zamienniki", "/serwis/modele"]);
    expect(roleRequiresSalesPerson("serwis")).toBe(true);
  });
});

describe("menu serwisu", () => {
  it("„Części serwisowe” (/serwis) nie świeci na podstronach, które mają własne pozycje, ani poza serwisem", async () => {
    const { isNavItemActive } = await import("@/lib/nav");
    const siblings = ["/serwis/zlecenia", "/serwis", "/serwis/zamienniki", "/serwis/modele"];
    for (const p of ["/serwis/zlecenia", "/serwis/zamienniki", "/serwis/modele"]) {
      expect(isNavItemActive(p, "/serwis", siblings)).toBe(false);
    }
    expect(isNavItemActive("/serwis", "/serwis", siblings)).toBe(true);
    expect(isNavItemActive("/serwisy", "/serwis", siblings)).toBe(false);
    expect(isNavItemActive("/zakupy/szacunek", "/serwis", siblings)).toBe(false);
  });
});
