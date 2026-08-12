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
  NAV_SECTION_TEETH_TOOLS,
  NAV_SECTION_ZK,
  NAV_SECTION_INFO,
  NAV_SECTION_CARRIERS,
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

  it("zwraca Magazyn Gądki dla /zakupy/gadki", () => {
    expect(pageTitle("/zakupy/gadki")).toBe("Magazyn Gądki");
  });

  it("zwraca Kreator ZD dla /zakupy/szacunek", () => {
    expect(pageTitle("/zakupy/szacunek")).toBe("Kreator ZD");
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
  it("grupuje workflow w sekcji Dziś, Zespół, Dostawcy, Archiwum i Kurierzy", () => {
    const groups = navForRole("zakupy");
    expect(groups.map((g) => g.title)).toEqual([
      NAV_SECTION_TODAY,
      "Zespół",
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TOOLS,
      NAV_SECTION_CARRIERS,
    ]);
  });

  it("sekcje od Dostawców są zwijane", () => {
    const groups = navForRole("zakupy");
    const collapsibleSections = groups.filter((g) => g.collapsible);
    expect(collapsibleSections.map((g) => g.title)).toEqual([
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TOOLS,
      NAV_SECTION_CARRIERS,
    ]);
  });

  it("sekcje Archiwum i System są domyślnie zwinięte", () => {
    const groups = navForRole("zakupy");
    const defaultCollapsed = groups.filter((g) => g.defaultCollapsed);
    expect(defaultCollapsed.map((g) => g.title)).toEqual([
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

  it("admin — Kreator ZD w sekcji Dziś (nie w Dostawcach)", () => {
    const today = navForRole("admin").find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => item.href)).toEqual([
      "/podsumowanie",
      "/weryfikacja",
      "/kolejka",
      "/zakupy/szacunek",
    ]);
    expect(today?.items.find((i) => i.href === "/zakupy/szacunek")?.tone).toBe(
      "violet"
    );
  });

  it("mobile overflow zawiera notatki, narzędzia i numery kurierów", () => {
    const groups = navForRole("zakupy");
    const labels = navMobileOverflowItems(groups).map((item) => item.label);
    expect(labels).toContain("Notatki");
    expect(labels).not.toContain("Panel zębów");
    expect(labels).toContain("Historia");
    expect(labels).toContain("Zamówienie grupowe");
    expect(labels).toContain("Numery kurierów");
  });
});

describe("teethNavGroups", () => {
  it("ma sekcje Dziś → Dostawcy → Zespół (+ Narzędzia gdy jest podsumowanie miesiąca)", () => {
    const groups = teethNavGroups();
    const titles = groups.map((g) => g.title);
    expect(titles.slice(0, 3)).toEqual([
      NAV_SECTION_TODAY,
      NAV_SECTION_SUPPLIERS,
      NAV_SECTION_TEAM,
    ]);
    if (new Date().getDate() <= 7) {
      expect(titles).toContain(NAV_SECTION_TEETH_TOOLS);
    } else {
      expect(titles).not.toContain(NAV_SECTION_TEETH_TOOLS);
    }
  });

  it("żadna sekcja nie jest zwijana (pojedyncze linki zawsze widoczne)", () => {
    const groups = teethNavGroups();
    expect(groups.every((g) => !g.collapsible)).toBe(true);
    expect(groups.every((g) => !g.defaultCollapsed)).toBe(true);
  });

  it("sekcja Dziś — pipeline: kolejka → weryfikacja → przyjęcie → historia", () => {
    const today = teethNavGroups().find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => item.href)).toEqual([
      "/zeby/kolejka",
      "/zeby/weryfikacja",
      "/zeby/przyjecie",
      "/zeby/historia",
    ]);
  });

  it("sekcja Dostawcy — braki i karty (bez tablicy/urlopów/kurierów)", () => {
    const suppliers = teethNavGroups().find((g) => g.title === NAV_SECTION_SUPPLIERS);
    expect(suppliers?.items.map((item) => item.href)).toEqual([
      "/zeby/braki",
      "/zakupy/dostawcy?tor=zeby",
    ]);
  });

  it("sekcja Zespół — tylko notatki", () => {
    const team = teethNavGroups().find((g) => g.title === NAV_SECTION_TEAM);
    expect(team?.items.map((item) => item.href)).toEqual(["/notatki"]);
  });

  it("menu zębów nie zawiera tablicy, urlopów działu ani kurierów", () => {
    const hrefs = teethNavGroups().flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/zakupy/tablica");
    expect(hrefs).not.toContain("/urlopy");
    expect(hrefs).not.toContain("/kurierzy");
  });

  it("sekcja Dziś ma semantyke jak Dostawy — bez osobnych iconTone", () => {
    const today = teethNavGroups().find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => [item.label, item.tone, item.iconTone, item.tier, item.highlight])).toEqual([
      ["Kolejka", "indigo", undefined, "primary", true],
      ["Weryfikacja", "amber", undefined, "primary", undefined],
      ["Przyjęcie", "emerald", undefined, "primary", undefined],
      ["Historia", "slate", undefined, "primary", undefined],
    ]);
  });

  it("Karty dostawców są stonowane (slate)", () => {
    const suppliers = teethNavGroups().find((g) => g.title === NAV_SECTION_SUPPLIERS);
    const cards = suppliers?.items.find((i) => i.href === "/zakupy/dostawcy?tor=zeby");
    expect(cards?.tone).toBe("slate");
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

  it("overflow — braki, karty, notatki (bez tablicy/urlopów/kurierów)", () => {
    const overflow = navMobileOverflowItems(teethNavGroups());
    const expectedLabels = ["Braki", "Karty dostawców", "Notatki"];
    if (new Date().getDate() <= 7) {
      expectedLabels.push("Podsumowanie miesiąca");
    }
    expect(overflow.map((item) => item.label)).toEqual(expectedLabels);
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
  it("domyślnie zwraca menu obszaru zębów (Dziś → Dostawcy → Zespół)", () => {
    const groups = navForRole("zakupy_zeby");
    expect(groups.map((g) => g.title).slice(0, 3)).toEqual([
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

  it("zakupy ma Magazyn Gądki; Kreator ZD tylko admin w Dziś; zęby/magazyn — bez obu", () => {
    const suppliers = navForRole("zakupy").find((g) => g.title === NAV_SECTION_SUPPLIERS);
    const gadki = suppliers?.items.find((i) => i.href === "/zakupy/gadki");
    expect(gadki?.icon).toBe("magazynGadki");
    expect(gadki?.iconTone).toBe("emerald");
    expect(suppliers?.items.some((i) => i.href === "/zakupy/gadki")).toBe(true);
    expect(suppliers?.items.some((i) => i.href === "/zakupy/szacunek")).toBe(false);
    const zakupyToday = navForRole("zakupy").find((g) => g.title === NAV_SECTION_TODAY);
    expect(zakupyToday?.items.some((i) => i.href === "/zakupy/szacunek")).toBe(false);
    const adminToday = navForRole("admin").find((g) => g.title === NAV_SECTION_TODAY);
    expect(adminToday?.items.some((i) => i.href === "/zakupy/szacunek")).toBe(true);
    const adminSuppliers = navForRole("admin").find((g) => g.title === NAV_SECTION_SUPPLIERS);
    expect(adminSuppliers?.items.some((i) => i.href === "/zakupy/szacunek")).toBe(false);
    const teethHrefs = navForRole("zakupy_zeby").flatMap((g) => g.items.map((i) => i.href));
    expect(teethHrefs.includes("/zakupy/gadki")).toBe(false);
    expect(teethHrefs.includes("/zakupy/szacunek")).toBe(false);
    const magHrefs = navForRole("magazyn").flatMap((g) => g.items.map((i) => i.href));
    expect(magHrefs.includes("/zakupy/gadki")).toBe(false);
  });
});

describe("navForRole magazyn", () => {
  it("ma sekcje Dziś, Zespół, Archiwum i Kurierzy (jak operacje)", () => {
    const groups = navForRole("magazyn");
    expect(groups.map((g) => g.title)).toEqual([
      NAV_SECTION_TODAY,
      "Zespół",
      NAV_SECTION_TOOLS,
      NAV_SECTION_CARRIERS,
    ]);
  });

  it("sekcje Archiwum i Kurierzy są zwijane", () => {
    const groups = navForRole("magazyn");
    const collapsibleSections = groups.filter((g) => g.collapsible);
    expect(collapsibleSections.map((g) => g.title)).toEqual([
      NAV_SECTION_TOOLS,
      NAV_SECTION_CARRIERS,
    ]);
  });

  it("sekcja Archiwum jest domyślnie zwinięta", () => {
    const groups = navForRole("magazyn");
    const defaultCollapsed = groups.filter((g) => g.defaultCollapsed);
    expect(defaultCollapsed.map((g) => g.title)).toEqual([
      NAV_SECTION_TOOLS,
    ]);
  });

  it("mobile primary — Przyjęcie towaru, Plan dostaw, Notatki", () => {
    const primary = navMobilePrimaryItems(navForRole("magazyn"));
    expect(primary.map((item) => item.mobileLabel ?? item.label)).toEqual([
      "Magazyn",
      "Dostawy",
      "Notatki",
    ]);
  });

  it("sekcja Dziś ma Przyjęcie i Plan dostaw", () => {
    const today = navForRole("magazyn").find((g) => g.title === NAV_SECTION_TODAY);
    expect(today?.items.map((item) => item.href)).toEqual([
      "/kolejka",
      "/dostawy",
    ]);
  });

  it("sekcja Zespół ma Notatki i Urlopy", () => {
    const team = navForRole("magazyn").find((g) => g.title === "Zespół");
    expect(team?.items.map((item) => item.href)).toEqual([
      "/notatki?dzial=magazyn",
      "/urlopy",
    ]);
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
