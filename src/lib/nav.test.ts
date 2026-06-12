import { describe, expect, it } from "vitest";
import {
  isNavItemActive,
  navForRole,
  navMobileOverflowItems,
  navMobilePrimaryItems,
  NAV_SECTION_SUPPLIERS,
  NAV_SECTION_TODAY,
  NAV_SECTION_TOOLS,
  pageTitle,
} from "./nav";

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

  it("podświetla notatki magazynu na /notatki", () => {
    expect(isNavItemActive("/notatki", "/notatki?dzial=magazyn")).toBe(true);
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
  it("zwraca Handlowcy dla /zespol/handlowcy", () => {
    expect(pageTitle("/zespol/handlowcy")).toBe("Handlowcy");
  });

  it("zwraca Grupy dla /zespol/grupy (admin w menu)", () => {
    expect(pageTitle("/zespol/grupy")).toBe("Grupy");
  });

  it("zwraca Przyjęcie towaru dla /kolejka", () => {
    expect(pageTitle("/kolejka")).toBe("Przyjęcie towaru");
  });

  it("zwraca Karty dostawców dla admin dostawcy", () => {
    expect(pageTitle("/admin/dostawcy")).toBe("Karty dostawców");
    expect(pageTitle("/admin/dostawcy/nieaktywni")).toBe("Nieaktywni dostawcy");
    expect(pageTitle("/admin/urlopy")).toBe("Urlopy");
  });

  it("zwraca ZK czekające dla /notatnik i /zk", () => {
    expect(pageTitle("/notatnik")).toBe("ZK czekające");
    expect(pageTitle("/zk")).toBe("ZK czekające");
  });
});

describe("navForRole admin dostawcy", () => {
  it("wskazuje admin ścieżki w sekcji Dostawcy", () => {
    const groups = navForRole("admin");
    const suppliers = groups.find((g) => g.title === NAV_SECTION_SUPPLIERS);
    expect(suppliers?.items[0]?.href).toBe("/admin/dostawcy");
    expect(suppliers?.items[2]?.href).toBe("/admin/urlopy");
  });
});

describe("navForRole struktura zakupów", () => {
  it("grupuje workflow w sekcji Dziś, Zespół, Dostawcy i Archiwum", () => {
    const groups = navForRole("zakupy");
    expect(groups.map((g) => g.title)).toEqual([
      NAV_SECTION_TODAY,
      "Zespół",
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TOOLS,
    ]);
  });

  it("mobile primary zawiera panel, weryfikację, magazyn i tablicę", () => {
    const groups = navForRole("zakupy");
    const labels = navMobilePrimaryItems(groups).map((item) => item.label);
    expect(labels).toEqual([
      "Panel dzienny",
      "Weryfikacja",
      "Przyjęcie towaru",
      "Tablica",
    ]);
  });

  it("mobile overflow zawiera notatki i narzędzia", () => {
    const groups = navForRole("zakupy");
    const labels = navMobileOverflowItems(groups).map((item) => item.label);
    expect(labels).toContain("Notatki");
    expect(labels).toContain("Historia");
    expect(labels).toContain("Zamówienie grupowe");
  });
});

describe("navForRole handlowiec", () => {
  it("używa Tablica zamiast Komunikacja", () => {
    const groups = navForRole("sales");
    const info = groups.find((g) => g.title === "Informacje");
    expect(info?.items[0]?.label).toBe("Tablica");
  });

  it("mobile primary ma cztery codzienne pozycje", () => {
    const primary = navMobilePrimaryItems(navForRole("sales"));
    expect(primary.map((item) => item.mobileLabel ?? item.label)).toEqual([
      "Moje",
      "Prośba",
      "ZK",
      "Tablica",
    ]);
  });
});
