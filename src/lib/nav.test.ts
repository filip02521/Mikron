import { describe, expect, it } from "vitest";
import {
  isNavItemActive,
  navForRole,
  navItemDisplayTone,
  navItemHasDueReminders,
  navMobileOverflowItems,
  navMobilePrimaryItems,
  NAV_SECTION_DAILY,
  NAV_SECTION_SUPPLIERS,
  NAV_SECTION_TEAM,
  NAV_SECTION_TODAY,
  NAV_SECTION_TOOLS,
  NAV_SECTION_ZK,
  NAV_SECTION_INFO,
  navForAppContext,
  teethNavGroups,
  pageTitle,
  type NavItem,
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

  it("podświetla Terminy zamówień na każdej lokalizacji", () => {
    const siblings = ["/zakupy/dostawcy", "/lokalizacje/POLSKA", "/zakupy/urlopy"];
    expect(isNavItemActive("/lokalizacje/ZAGRANICA", "/lokalizacje/POLSKA", siblings)).toBe(
      true
    );
  });

  it("podświetla notatki magazynu na /notatki", () => {
    expect(isNavItemActive("/notatki", "/notatki?dzial=magazyn")).toBe(true);
  });

  it("rozróżnia widoki /zeby/kolejka i /zeby/historia", () => {
    const siblings = ["/zeby/kolejka", "/zeby/historia"];
    expect(isNavItemActive("/zeby/kolejka", "/zeby/historia", siblings)).toBe(false);
    expect(isNavItemActive("/zeby/historia", "/zeby/historia", siblings)).toBe(true);
    expect(isNavItemActive("/zeby/kolejka", "/zeby/kolejka", siblings)).toBe(true);
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
    expect(pageTitle("/admin/urlopy")).toBe("Urlopy dostawców");
  });

  it("zwraca ZK czekające dla /notatnik i /zk", () => {
    expect(pageTitle("/notatnik")).toBe("Notatnik");
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

  it("sekcja Dziś ma rozróżnialne tony semanticzne", () => {
    const today = navForRole("zakupy").find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => [item.label, item.tone])).toEqual([
      ["Panel dzienny", "indigo"],
      ["Weryfikacja", "amber"],
      ["Przyjęcie towaru", "emerald"],
    ]);
  });

  it("mobile overflow zawiera notatki i narzędzia bez panelu zębów", () => {
    const groups = navForRole("zakupy");
    const labels = navMobileOverflowItems(groups).map((item) => item.label);
    expect(labels).toContain("Notatki");
    expect(labels).not.toContain("Panel zębów");
    expect(labels).toContain("Historia");
    expect(labels).toContain("Zamówienie grupowe");
  });
});

describe("teethNavGroups", () => {
  it("ma sekcje Dziś, Dostawcy i Zespół (workflow od góry)", () => {
    const groups = teethNavGroups();
    expect(groups.map((g) => g.title)).toEqual([
      NAV_SECTION_TODAY,
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TEAM,
    ]);
  });

  it("sekcja Dziś — kolejność workflow: kolejka, weryfikacja, przyjęcie, historia", () => {
    const today = teethNavGroups().find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => item.href)).toEqual([
      "/zeby/kolejka",
      "/zeby/weryfikacja",
      "/zeby/przyjecie",
      "/zeby/historia",
    ]);
  });

  it("sekcja Dziś ma rozróżnialne tony i rozmiary (primary)", () => {
    const today = teethNavGroups().find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => [item.label, item.tone, item.iconTone, item.tier, item.highlight])).toEqual([
      ["Kolejka", "slate", "indigo", "primary", true],
      ["Weryfikacja", "slate", "amber", "primary", undefined],
      ["Przyjęcie", "slate", "emerald", "primary", undefined],
      ["Historia", "slate", "sky", "primary", undefined],
    ]);
  });

  it("mobile primary — cztery codzienne ekrany workflow", () => {
    const primary = navMobilePrimaryItems(teethNavGroups());
    expect(primary.map((item) => item.mobileLabel ?? item.label)).toEqual([
      "Kolejka",
      "Weryfikacja",
      "Przyjęcie",
      "Historia",
    ]);
  });

  it("rzadsze pozycje są compact w overflow", () => {
    const overflow = navMobileOverflowItems(teethNavGroups());
    expect(overflow.map((item) => item.label)).toEqual([
      "Karty dostawców",
      "Tablica",
      "Notatki",
      "Urlopy działu",
    ]);
    expect(overflow.every((item) => item.tier === "compact")).toBe(true);
  });
});

describe("navForAppContext", () => {
  it("zakupy_zeby w obszarze zeby używa menu zębów", () => {
    const groups = navForAppContext({
      realRole: "zakupy_zeby",
      navRole: "zakupy_zeby",
      procurementWorkspace: "zeby",
    });
    expect(groups[0]?.title).toBe(NAV_SECTION_TODAY);
    expect(groups[0]?.items[0]?.href).toBe("/zeby/kolejka");
  });

  it("zakupy_zeby w obszarze dostawy używa menu zakupów", () => {
    const groups = navForAppContext({
      realRole: "zakupy_zeby",
      navRole: "zakupy_zeby",
      procurementWorkspace: "dostawy",
    });
    expect(groups[0]?.items[0]?.href).toBe("/podsumowanie");
  });
});

describe("navForRole zakupy_zeby", () => {
  it("domyślnie zwraca pełne menu obszaru zębów", () => {
    const groups = navForRole("zakupy_zeby");
    expect(groups.map((g) => g.title)).toEqual([
      NAV_SECTION_TODAY,
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TEAM,
    ]);
  });

  it("zakupy nie ma pozycji zębów w menu", () => {
    const groups = navForRole("zakupy");
    const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(allHrefs.some((href) => href.startsWith("/zeby"))).toBe(false);
  });
});

describe("navForRole handlowiec", () => {
  it("używa Tablica zamiast Komunikacja", () => {
    const groups = navForRole("sales");
    const info = groups.find((g) => g.title === NAV_SECTION_INFO);
    expect(info?.items[0]?.label).toBe("Tablica");
  });

  it("umieszcza Notatnik w sekcji Codziennie pod Nową prośbą", () => {
    const groups = navForRole("sales");
    const daily = groups.find((g) => g.title === NAV_SECTION_DAILY);
    const zk = groups.find((g) => g.title === NAV_SECTION_ZK);
    expect(daily?.items.map((item) => item.href)).toEqual(["/moje", "/prosba", "/notatnik"]);
    expect(zk?.items.map((item) => item.href)).toEqual(["/zk", "/plan"]);
    expect(groups.some((g) => g.title === "Notatnik")).toBe(false);
  });

  it("przypisuje tony semantyczne pozycjom menu", () => {
    const groups = navForRole("sales");
    const daily = groups.find((g) => g.title === NAV_SECTION_DAILY);
    const zk = groups.find((g) => g.title === NAV_SECTION_ZK);
    const info = groups.find((g) => g.title === NAV_SECTION_INFO);

    expect(daily?.items.map((item) => [item.label, item.tone])).toEqual([
      ["Moje zamówienia", "indigo"],
      ["Nowa prośba", "indigo"],
      ["Notatnik", "indigo"],
    ]);
    expect(zk?.items.map((item) => [item.label, item.tone])).toEqual([
      ["ZK czekające", "violet"],
      ["Harmonogram", "sky"],
    ]);
    expect(info?.items[0]?.tone).toBe("indigo");
  });

  it("mobile primary ma pięć codziennych pozycji", () => {
    const primary = navMobilePrimaryItems(navForRole("sales"));
    expect(primary.map((item) => item.mobileLabel ?? item.label)).toEqual([
      "Moje",
      "Prośba",
      "Notatki",
      "ZK",
      "Tablica",
    ]);
  });
});

function salesNavItem(href: string, badge?: number): NavItem {
  const groups = navForRole("sales", { salesNotesDue: 0, salesZkDue: 0 });
  for (const group of groups) {
    const item = group.items.find((i) => i.href === href);
    if (item) return { ...item, badge };
  }
  throw new Error(`missing nav item ${href}`);
}

function operationsNavItem(href: string, badge?: number): NavItem {
  const groups = navForRole("zakupy", { departmentBoardQuestions: 0 });
  for (const group of groups) {
    const item = group.items.find((i) => i.href === href);
    if (item) return { ...item, badge };
  }
  throw new Error(`missing nav item ${href}`);
}

describe("navItemHasDueReminders", () => {
  it("zwraca true dla Notatnik i ZK z badge > 0", () => {
    expect(navItemHasDueReminders(salesNavItem("/notatnik", 2))).toBe(true);
    expect(navItemHasDueReminders(salesNavItem("/zk", 1))).toBe(true);
  });

  it("zwraca true dla tablicy zakupów z otwartymi pytaniami", () => {
    expect(navItemHasDueReminders(operationsNavItem("/zakupy/tablica", 2))).toBe(true);
  });

  it("zwraca false bez badge lub na innych ścieżkach", () => {
    expect(navItemHasDueReminders(salesNavItem("/notatnik", 0))).toBe(false);
    expect(navItemHasDueReminders(salesNavItem("/zk"))).toBe(false);
    expect(navItemHasDueReminders(salesNavItem("/moje", 3))).toBe(false);
    expect(navItemHasDueReminders(salesNavItem("/tablica", 2))).toBe(false);
    expect(navItemHasDueReminders(operationsNavItem("/zakupy/tablica", 0))).toBe(false);
  });
});

describe("navItemDisplayTone", () => {
  it("używa amber w spoczynku przy przypomnieniach", () => {
    expect(navItemDisplayTone(salesNavItem("/notatnik", 2), false)).toBe("amber");
    expect(navItemDisplayTone(salesNavItem("/zk", 1), false)).toBe("amber");
    expect(navItemDisplayTone(operationsNavItem("/zakupy/tablica", 2), false)).toBe("amber");
  });

  it("zachowuje ton pozycji gdy aktywna lub brak przypomnień", () => {
    expect(navItemDisplayTone(salesNavItem("/notatnik", 2), true)).toBe("indigo");
    expect(navItemDisplayTone(salesNavItem("/zk", 1), true)).toBe("violet");
    expect(navItemDisplayTone(salesNavItem("/notatnik", 0), false)).toBe("indigo");
    expect(navItemDisplayTone(salesNavItem("/zk"), false)).toBe("violet");
  });
});
