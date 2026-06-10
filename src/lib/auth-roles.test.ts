import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  canManageSalesTeam,
  homePathForRole,
  isSalesAccount,
  isSalesManager,
  redirectPathAfterLogin,
} from "./auth-roles";

describe("auth-roles sales_manager", () => {
  it("treats sales_manager as sales account for handlowiec routes", () => {
    expect(isSalesAccount("sales_manager")).toBe(true);
    expect(isSalesManager("sales_manager")).toBe(true);
    expect(canAccessPath("sales_manager", "/moje")).toBe(true);
    expect(canAccessPath("sales_manager", "/prosba")).toBe(true);
    expect(canAccessPath("sales_manager", "/plan")).toBe(true);
  });

  it("allows team management routes only for manager and admin", () => {
    expect(canManageSalesTeam("sales_manager")).toBe(true);
    expect(canManageSalesTeam("admin")).toBe(true);
    expect(canManageSalesTeam("sales")).toBe(false);
    expect(canAccessPath("sales_manager", "/zespol")).toBe(true);
    expect(canAccessPath("sales_manager", "/zespol/handlowcy")).toBe(true);
    expect(canAccessPath("sales_manager", "/zespol/grupy")).toBe(true);
    expect(canAccessPath("sales", "/zespol")).toBe(false);
  });

  it("uses zespol as home for manager", () => {
    expect(homePathForRole("sales_manager")).toBe("/zespol");
  });

  it("allows admin sales preview with ?dla=", () => {
    expect(canAccessPath("admin", "/notatnik")).toBe(false);
    expect(canAccessPath("admin", "/notatnik", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/moje")).toBe(false);
    expect(canAccessPath("admin", "/moje", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/plan", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/prosba", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/tablica", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("sales", "/notatnik")).toBe(true);
  });
});

describe("auth-roles admin panel context", () => {
  it("delegates path access to preview context for admin", () => {
    expect(
      canAccessPath("admin", "/kolejka", { adminPanelContext: "magazyn" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/podsumowanie", { adminPanelContext: "magazyn" })
    ).toBe(false);
    expect(
      canAccessPath("admin", "/admin", { adminPanelContext: "zakupy" })
    ).toBe(false);
    expect(
      canAccessPath("admin", "/moje", { adminPanelContext: "sales" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/admin/wybor-handlowca", {
        adminPanelContext: "sales",
      })
    ).toBe(true);
  });

  it("keeps full admin access when context is admin", () => {
    expect(
      canAccessPath("admin", "/admin", { adminPanelContext: "admin" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/podsumowanie", { adminPanelContext: "admin" })
    ).toBe(true);
  });
});

describe("redirectPathAfterLogin admin panel context", () => {
  it("redirects admin to preview home when cookie context is set", () => {
    expect(
      redirectPathAfterLogin("admin", null, { adminPanelContext: "magazyn" })
    ).toBe("/kolejka");
    expect(
      redirectPathAfterLogin("admin", null, { adminPanelContext: "sales" })
    ).toBe("/admin/wybor-handlowca");
  });
});
