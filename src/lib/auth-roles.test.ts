import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  canManageSalesTeam,
  homePathForRole,
  isSalesAccount,
  isSalesManager,
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
});
