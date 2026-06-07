import { describe, expect, it } from "vitest";
import { isNavItemActive, navForRole, pageTitle } from "./nav";

describe("isNavItemActive", () => {
  const zespolSiblings = ["/zespol", "/zespol/handlowcy", "/zespol/grupy"];

  it("podświetla tylko handlowcy na /zespol/handlowcy", () => {
    const pathname = "/zespol/handlowcy";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(false);
    expect(isNavItemActive(pathname, "/zespol/handlowcy", zespolSiblings)).toBe(true);
  });

  it("podświetla podgląd na /zespol", () => {
    const pathname = "/zespol";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(true);
    expect(isNavItemActive(pathname, "/zespol/handlowcy", zespolSiblings)).toBe(false);
  });

  it("podświetla grupy na /zespol/grupy", () => {
    const pathname = "/zespol/grupy";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(false);
    expect(isNavItemActive(pathname, "/zespol/grupy", zespolSiblings)).toBe(true);
  });

  it("nie podświetla kart dostawców na /admin/dostawcy/nieaktywni", () => {
    const pathname = "/admin/dostawcy/nieaktywni";
    const siblings = ["/admin/dostawcy", "/lokalizacje/POLSKA", "/admin/urlopy"];
    expect(isNavItemActive(pathname, "/admin/dostawcy", siblings)).toBe(false);
  });

  it("podświetla Administracja tylko na hubie system/konta/handlowcy", () => {
    const siblings = ["/admin", "/admin/zgloszenia", "/admin/produkty", "/zespol/grupy"];
    expect(isNavItemActive("/admin", "/admin", siblings)).toBe(true);
    expect(isNavItemActive("/admin/uzytkownicy", "/admin", siblings)).toBe(true);
    expect(isNavItemActive("/admin/handlowcy", "/admin", siblings)).toBe(true);
    expect(isNavItemActive("/admin/dostawcy", "/admin", siblings)).toBe(false);
    expect(isNavItemActive("/admin/urlopy", "/admin", siblings)).toBe(false);
    expect(isNavItemActive("/admin/zgloszenia", "/admin", siblings)).toBe(false);
    expect(isNavItemActive("/podsumowanie", "/admin", siblings)).toBe(false);
  });

  it("podświetla karty dostawców admin w sekcji Dostawcy", () => {
    const siblings = ["/admin/dostawcy", "/lokalizacje/POLSKA", "/admin/urlopy"];
    expect(isNavItemActive("/admin/dostawcy", "/admin/dostawcy", siblings)).toBe(true);
    expect(isNavItemActive("/admin/urlopy", "/admin/urlopy", siblings)).toBe(true);
  });
});

describe("pageTitle", () => {
  it("zwraca Handlowcy i konta dla /zespol/handlowcy", () => {
    expect(pageTitle("/zespol/handlowcy")).toBe("Handlowcy i konta");
  });

  it("zwraca Grupy zespołu dla /zespol/grupy (admin w menu)", () => {
    expect(pageTitle("/zespol/grupy")).toBe("Grupy zespołu");
  });

  it("zwraca Karty dostawców dla admin dostawcy", () => {
    expect(pageTitle("/admin/dostawcy")).toBe("Karty dostawców");
    expect(pageTitle("/admin/dostawcy/nieaktywni")).toBe("Nieaktywni dostawcy");
    expect(pageTitle("/admin/urlopy")).toBe("Urlopy");
  });
});

describe("navForRole admin dostawcy", () => {
  it("wskazuje admin ścieżki w sekcji Dostawcy", () => {
    const groups = navForRole("admin");
    const suppliers = groups.find((g) => g.title === "Dostawcy");
    expect(suppliers?.items[0]?.href).toBe("/admin/dostawcy");
    expect(suppliers?.items[2]?.href).toBe("/admin/urlopy");
  });
});
