import type { UserRole } from "@/types/database";
import { isSalesManager } from "@/lib/auth-roles";
import type { ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import { salesManagerNavTeamDescriptions } from "@/lib/sales/team-ui";
import { supplierHubPaths } from "@/lib/supplier-hub";
import { ROLE_LABELS } from "@/lib/users/labels";

export type NavIconKey =
  | "dailyPanel"
  | "verification"
  | "warehouse"
  | "history"
  | "suppliers"
  | "schedule"
  | "vacation"
  | "groupOrder"
  | "admin"
  | "bugReport"
  | "catalog"
  | "myOrders"
  | "newRequest"
  | "plan"
  | "notepad"
  | "clientZk"
  | "board"
  | "team"
  | "teamAccounts"
  | "teamGroups"
  | "teeth";

export type NavTone = "indigo" | "amber" | "orange" | "emerald" | "sky" | "slate" | "violet";

export type NavTier = "primary" | "compact";

export type NavMobileSlot = "primary" | "overflow";

export type NavItem = {
  href: string;
  label: string;
  /** Krótsza etykieta w dolnej nawigacji mobilnej. */
  mobileLabel?: string;
  description?: string;
  badge?: number;
  icon: NavIconKey;
  tone: NavTone;
  /** Opcjonalny ton dla kafelka ikony — gdy różny od `tone`. */
  iconTone?: NavTone;
  tier?: NavTier;
  /** Delikatne wyróżnienie punktu startowego (Panel / Moje). */
  highlight?: boolean;
  /** Wcięty sub-item pod poprzednią pozycją (np. Panel zębów pod Panel dzienny). */
  indent?: boolean;
  mobileSlot?: NavMobileSlot;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTION_TODAY = "Dziś";
export const NAV_SECTION_TEAM = "Zespół";
export const NAV_SECTION_SUPPLIERS = "Dostawcy";
export const NAV_SECTION_TOOLS = "Archiwum i narzędzia";
export const NAV_SECTION_SYSTEM = "System";
export const NAV_SECTION_DAILY = "Codziennie";
export const NAV_SECTION_ZK = "ZK i terminy";
export const NAV_SECTION_INFO = "Informacje";
export const NAV_SECTION_REALIZATION = "Realizacja";
export const NAV_SECTION_HELP = "Pomoc";

/**
 * Sidebar „Administracja” (/admin) = hub system + konta + handlowcy.
 * Inne ścieżki /admin/* (dostawcy, urlopy, zgłoszenia…) mają własne pozycje menu.
 */
function isAdminSidebarRootActive(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/uzytkownicy") ||
    pathname.startsWith("/admin/handlowcy")
  );
}

function navHrefPath(href: string): string {
  return href.split("?")[0]!;
}

const DEPARTMENT_BOARD_PROCUREMENT_PATH = "/zakupy/tablica";

const SALES_DUE_REMINDER_NAV_PATHS = new Set(["/notatnik", "/zk"]);
const PROCUREMENT_BOARD_ATTENTION_PATHS = new Set([DEPARTMENT_BOARD_PROCUREMENT_PATH]);

/** Notatnik, ZK lub tablica z otwartymi pytaniami — subtelne podświetlenie w menu. */
export function navItemHasDueReminders(item: NavItem): boolean {
  const path = navHrefPath(item.href);
  if (SALES_DUE_REMINDER_NAV_PATHS.has(path) || PROCUREMENT_BOARD_ATTENTION_PATHS.has(path)) {
    return (item.badge ?? 0) > 0;
  }
  return false;
}

/** Ton wizualny w menu — amber w spoczynku przy przypomnieniach; aktywna strona zachowuje ton pozycji. */
export function navItemDisplayTone(item: NavItem, active: boolean): NavTone {
  if (!active && navItemHasDueReminders(item)) return "amber";
  return item.tone;
}

/**
 * Czy punkt menu jest aktywny.
 * Nie podświetla krótszego href (np. /zespol), gdy pathname pasuje do dokładniejszego siblinga (/zespol/handlowcy).
 * Gdy href zawiera query string (np. /zakupy/dostawcy?tor=zeby), sprawdza też activeSearch.
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: string[] = [],
  activeSearch?: string,
): boolean {
  const hrefPath = navHrefPath(href);
  const hrefQuery = href.includes("?") ? href.split("?")[1] ?? "" : null;

  if (hrefPath === "/admin") {
    return isAdminSidebarRootActive(pathname);
  }
  if (hrefPath.startsWith("/lokalizacje/") && pathname.startsWith("/lokalizacje/")) {
    return true;
  }

  const pathMatches =
    pathname === hrefPath ||
    (pathname.startsWith(`${hrefPath}/`) &&
      !siblingHrefs.some(
        (other) =>
          other !== href &&
          navHrefPath(other).startsWith(`${hrefPath}/`) &&
          (pathname === navHrefPath(other) || pathname.startsWith(`${navHrefPath(other)}/`))
      ));

  if (!pathMatches) return false;
  if (hrefPath.endsWith("/dostawcy") && pathname.includes("/nieaktywni")) return false;

  const currentQuery = activeSearch !== undefined ? activeSearch.replace(/^\?/, "") : null;

  if (hrefQuery !== null) {
    if (currentQuery === null) return true;
    return currentQuery === hrefQuery;
  }

  const siblingsWithQuery = siblingHrefs.filter(
    (other) => other !== href && navHrefPath(other) === hrefPath && other.includes("?")
  );
  if (siblingsWithQuery.length > 0 && currentQuery !== null) {
    return !siblingsWithQuery.some((s) => s.split("?")[1] === currentQuery);
  }

  return true;
}

const OPERATIONS_NOTATKI_PATH = "/notatki";
/** Magazyn — jawny dział w URL (zakupy/admin domyślnie bez parametru). */
const OPERATIONS_NOTATKI_MAGAZYN = "/notatki?dzial=magazyn";

const TEETH_SUPPLIERS_PATH = "/zakupy/dostawcy?tor=zeby";

export type NavBadges = {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
  salesMoje?: number;
  salesZkDue?: number;
  salesNotesDue?: number;
  salesTablica?: number;
  operationsNotatki?: number;
  departmentBoardQuestions?: number;
  adminBugReports?: number;
  teethQueue?: number;
  teethVerification?: number;
  teethReceivePending?: number;
};

function teethTodayNavItems(
  badges: Pick<NavBadges, "teethQueue" | "teethVerification" | "teethReceivePending">
): NavItem[] {
  return [
    {
      href: "/zeby/kolejka",
      label: "Kolejka",
      mobileLabel: "Kolejka",
      description: "Prośby handlowców — oznacz zamówione u dostawcy",
      icon: "teeth",
      tone: "slate",
      iconTone: "indigo",
      tier: "primary",
      highlight: true,
      mobileSlot: "primary",
      badge: badges.teethQueue,
    },
    {
      href: "/zeby/weryfikacja",
      label: "Weryfikacja",
      mobileLabel: "Weryfikacja",
      description: "Prośby z listą zębów ze zdjęcia — zweryfikuj i zatwierdź",
      icon: "teeth",
      tone: "slate",
      iconTone: "amber",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.teethVerification,
    },
    {
      href: "/zeby/przyjecie",
      label: "Przyjęcie",
      mobileLabel: "Przyjęcie",
      description: "Co dotarło od labu — wpisz ilości i braki",
      icon: "warehouse",
      tone: "slate",
      iconTone: "emerald",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.teethReceivePending,
    },
    {
      href: "/zeby/historia",
      label: "Historia",
      mobileLabel: "Historia",
      description: "Zamówione u dostawcy — ETA, audyt i korekty",
      icon: "history",
      tone: "slate",
      iconTone: "sky",
      tier: "primary",
      mobileSlot: "primary",
    },
  ];
}

function teethSupplierNavItems(): NavItem[] {
  const compact = {
    tier: "compact" as const,
    mobileSlot: "overflow" as const,
  };
  return [
    {
      href: TEETH_SUPPLIERS_PATH,
      label: "Karty dostawców",
      description: "Cykl zębów, kontakt i dane labu",
      icon: "suppliers",
      tone: "sky",
      ...compact,
    },
  ];
}

function teethTeamNavItems(badges: {
  operationsNotatki?: number;
  departmentBoardQuestions?: number;
}): NavItem[] {
  return [
    {
      href: DEPARTMENT_BOARD_PROCUREMENT_PATH,
      label: "Tablica",
      mobileLabel: "Tablica",
      description: "Ogłoszenia i pytania handlowców",
      icon: "board",
      tone: "indigo",
      tier: "compact",
      mobileSlot: "overflow",
      badge: badges.departmentBoardQuestions,
    },
    {
      href: OPERATIONS_NOTATKI_PATH,
      label: "Notatki",
      mobileLabel: "Notatki",
      description: "Notatki zespołu zakupów",
      icon: "notepad",
      tone: "indigo",
      tier: "compact",
      mobileSlot: "overflow",
      badge: badges.operationsNotatki,
    },
    {
      href: "/urlopy",
      label: "Urlopy",
      mobileLabel: "Urlopy",
      description: "Urlopy działu — kto jest niedostępny",
      icon: "vacation",
      tone: "amber",
      tier: "compact",
      mobileSlot: "overflow",
    },
  ];
}

export function teethNavGroups(badges: NavBadges = {}): NavGroup[] {
  return [
    { title: NAV_SECTION_TODAY, items: teethTodayNavItems(badges) },
    { title: NAV_SECTION_TEAM, items: teethTeamNavItems(badges) },
    { title: NAV_SECTION_SUPPLIERS, items: teethSupplierNavItems() },
  ];
}

function operationsTodayItems(badges: Pick<NavBadges, "nowe" | "weryfikacja" | "realizacja">): NavItem[] {
  return [
    {
      href: "/podsumowanie",
      label: "Panel dzienny",
      mobileLabel: "Panel",
      description: "Kolejka dnia",
      icon: "dailyPanel",
      tone: "indigo",
      tier: "primary",
      highlight: true,
      mobileSlot: "primary",
      badge: badges.nowe,
    },
    {
      href: "/weryfikacja",
      label: "Weryfikacja",
      mobileLabel: "Weryfik.",
      description: "Brakujące dane prośby",
      icon: "verification",
      tone: "amber",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.weryfikacja,
    },
    {
      href: "/kolejka",
      label: "Przyjęcie towaru",
      mobileLabel: "Magazyn",
      description: "Przyjęcie i dziennik dostaw",
      icon: "warehouse",
      tone: "emerald",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.realizacja,
    },
  ];
}

function operationsTeamItems(badges: {
  operationsNotatki?: number;
  departmentBoardQuestions?: number;
}): NavItem[] {
  return [
    {
      href: DEPARTMENT_BOARD_PROCUREMENT_PATH,
      label: "Tablica",
      mobileLabel: "Tablica",
      description: "Ogłoszenia i pytania handlowców",
      icon: "board",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.departmentBoardQuestions,
    },
    {
      href: OPERATIONS_NOTATKI_PATH,
      label: "Notatki",
      mobileLabel: "Notatki",
      description: "Notatki zespołu zakupów",
      icon: "notepad",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "overflow",
      badge: badges.operationsNotatki,
    },
    {
      href: "/urlopy",
      label: "Urlopy",
      mobileLabel: "Urlopy",
      description: "Urlopy działu — kto jest niedostępny",
      icon: "vacation",
      tone: "amber",
      tier: "compact",
      mobileSlot: "overflow",
    },
  ];
}

function supplierHubItemsForRole(role: UserRole): NavItem[] {
  const compact = {
    tier: "compact" as const,
    mobileSlot: "overflow" as const,
  };

  if (role === "zakupy_zeby") {
    return [
      {
        href: TEETH_SUPPLIERS_PATH,
        label: "Karty dostawców",
        description: "Labs i dostawcy zębów",
        icon: "suppliers",
        tone: "sky",
        ...compact,
      },
      {
        href: "/zakupy/urlopy",
        label: "Urlopy",
        description: "Niedostępność dostawcy",
        icon: "vacation",
        tone: "sky",
        ...compact,
      },
    ];
  }

  if (role !== "admin") {
    return [
      {
        href: "/zakupy/dostawcy",
        label: "Karty dostawców",
        description: "Kontakt, zapas, cykl",
        icon: "suppliers",
        tone: "sky",
        ...compact,
      },
      {
        href: "/lokalizacje/POLSKA",
        label: "Terminy zamówień",
        description: "PL / ZA / Import",
        icon: "schedule",
        tone: "sky",
        ...compact,
      },
      {
        href: "/zakupy/urlopy",
        label: "Urlopy",
        description: "Niedostępność dostawcy",
        icon: "vacation",
        tone: "sky",
        ...compact,
      },
    ];
  }

  const paths = supplierHubPaths("admin");
  return [
    {
      href: paths.cards,
      label: "Karty dostawców",
      description: "Kontakt, zapas, cykl",
      icon: "suppliers",
      tone: "sky",
      ...compact,
    },
    {
      href: paths.schedule("POLSKA"),
      label: "Terminy zamówień",
      description: "PL / ZA / Import",
      icon: "schedule",
      tone: "sky",
      ...compact,
    },
    {
      href: paths.vacations,
      label: "Urlopy",
      description: "Niedostępność dostawcy",
      icon: "vacation",
      tone: "sky",
      ...compact,
    },
  ];
}

const archiveToolItems: NavItem[] = [
  {
    href: "/historia",
    label: "Historia",
    mobileLabel: "Historia",
    description: "Archiwum zamówień",
    icon: "history",
    tone: "slate",
    tier: "compact",
    mobileSlot: "overflow",
  },
  {
    href: "/zamowienia/nowe",
    label: "Zamówienie grupowe",
    description: "Formularz zbiorczy",
    icon: "groupOrder",
    tone: "slate",
    tier: "compact",
    mobileSlot: "overflow",
  },
];

function adminSystemItems(badges: { adminBugReports?: number }): NavItem[] {
  const compact = {
    tier: "compact" as const,
    mobileSlot: "overflow" as const,
  };

  return [
    {
      href: "/admin",
      label: "Administracja",
      description: "System, konta, handlowcy",
      icon: "admin",
      tone: "violet",
      ...compact,
    },
    {
      href: "/admin/zgloszenia",
      label: "Zgłoszenia",
      description: "Uwagi od handlowców",
      icon: "bugReport",
      tone: "violet",
      badge: badges.adminBugReports,
      ...compact,
    },
    {
      href: "/admin/produkty",
      label: "Katalog produktów",
      description: "Towar Subiekt → dostawca",
      icon: "catalog",
      tone: "violet",
      ...compact,
    },
    {
      href: "/admin/produkty/zeby",
      label: "Produkty zębne",
      description: "Wyjątek od kontroli stanu",
      icon: "catalog",
      tone: "violet",
      ...compact,
    },
    {
      href: "/zespol/grupy",
      label: "Grupy",
      description: "Sklep, Biuro — kolejność",
      icon: "teamGroups",
      tone: "violet",
      ...compact,
    },
  ];
}

function operationsNavGroups(role: UserRole, badges: NavBadges): NavGroup[] {
  const groups: NavGroup[] = [
    { title: NAV_SECTION_TODAY, items: operationsTodayItems(badges) },
    { title: NAV_SECTION_TEAM, items: operationsTeamItems(badges) },
    { title: NAV_SECTION_SUPPLIERS, items: supplierHubItemsForRole(role) },
    { title: NAV_SECTION_TOOLS, items: archiveToolItems },
  ];

  if (role === "admin") {
    groups.push({ title: NAV_SECTION_SYSTEM, items: adminSystemItems(badges) });
  }

  return groups;
}

function magazynNavGroups(badges: NavBadges): NavGroup[] {
  return [
    {
      title: NAV_SECTION_TODAY,
      items: [
        {
          href: "/kolejka",
          label: "Przyjęcie towaru",
          mobileLabel: "Magazyn",
          description: "Przyjęcie i dziennik dostaw",
          icon: "warehouse",
          tone: "emerald",
          tier: "primary",
          highlight: true,
          mobileSlot: "primary",
          badge: badges.realizacja,
        },
        {
          href: "/dostawy",
          label: "Plan dostaw",
          mobileLabel: "Dostawy",
          description: "Nadchodzące dostawy w tygodniu",
          icon: "schedule",
          tone: "sky",
          tier: "primary",
          mobileSlot: "primary",
        },
        {
          href: OPERATIONS_NOTATKI_MAGAZYN,
          label: "Notatki",
          mobileLabel: "Notatki",
          description: "Notatki magazynu",
          icon: "notepad",
          tone: "indigo",
          tier: "primary",
          mobileSlot: "primary",
          badge: badges.operationsNotatki,
        },
        {
          href: "/urlopy",
          label: "Urlopy",
          mobileLabel: "Urlopy",
          description: "Urlopy działu — kto jest niedostępny",
          icon: "vacation",
          tone: "amber",
          tier: "compact",
          mobileSlot: "overflow",
        },
      ],
    },
  ];
}

export type NavAppContext = {
  realRole: UserRole;
  /** Rola efektywna (podgląd admina). */
  navRole: UserRole;
  procurementWorkspace: ProcurementWorkspace | null;
  badges?: NavBadges;
};

/** Nawigacja z uwzględnieniem obszaru pracy zakupów (Dostawy vs Zęby vs Magazyn). */
export function navForAppContext(ctx: NavAppContext): NavGroup[] {
  const badges = ctx.badges ?? {};
  if (ctx.realRole === "admin") {
    return navForRole(ctx.navRole, badges);
  }
  if (ctx.procurementWorkspace === "zeby") {
    return teethNavGroups(badges);
  }
  if (ctx.procurementWorkspace === "magazyn") {
    return magazynNavGroups(badges);
  }
  if (ctx.realRole === "zakupy" || ctx.realRole === "zakupy_zeby") {
    return operationsNavGroups(ctx.navRole === "zakupy_zeby" ? "zakupy" : ctx.navRole, badges);
  }
  return navForRole(ctx.navRole, badges);
}

export function flattenNavGroups(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

export function navMobilePrimaryItems(groups: NavGroup[]): NavItem[] {
  return flattenNavGroups(groups).filter((item) => item.mobileSlot === "primary");
}

export function navMobileOverflowItems(groups: NavGroup[]): NavItem[] {
  return flattenNavGroups(groups).filter((item) => item.mobileSlot === "overflow");
}

export function navForRole(
  role: UserRole,
  badges: NavBadges = {}
): NavGroup[] {
  if (role === "zakupy_zeby") {
    return teethNavGroups(badges);
  }

  if (role === "admin" || role === "zakupy") {
    return operationsNavGroups(role, badges);
  }

  if (role === "magazyn") {
    return magazynNavGroups(badges);
  }

  const dailyItems: NavItem[] = [
    {
      href: "/moje",
      label: "Moje zamówienia",
      mobileLabel: "Moje",
      description: "Start dnia — prośby, ogłoszenia i przypomnienia",
      icon: "myOrders",
      tone: "indigo",
      tier: "primary",
      highlight: true,
      mobileSlot: "primary",
      badge: badges.salesMoje,
    },
    {
      href: "/prosba",
      label: "Nowa prośba",
      mobileLabel: "Prośba",
      description: "Zamówienie lub info o dostępności",
      icon: "newRequest",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "primary",
    },
    {
      href: "/notatnik",
      label: "Notatnik",
      mobileLabel: "Notatki",
      description: "Prywatne notatki — licznik: przypomnienia notatek",
      icon: "notepad",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.salesNotesDue,
    },
  ];

  const zkItems: NavItem[] = [
    {
      href: "/zk",
      label: "ZK czekające",
      mobileLabel: "ZK",
      description: "ZK z Subiekta — licznik: przypomnienia ZK",
      icon: "clientZk",
      tone: "violet",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.salesZkDue,
    },
    {
      href: "/plan",
      label: "Harmonogram",
      mobileLabel: "Plan",
      description: "Terminy u dostawców",
      icon: "plan",
      tone: "sky",
      tier: "primary",
      mobileSlot: "overflow",
    },
  ];

  const infoItems: NavItem[] = [
    {
      href: "/tablica",
      label: "Tablica",
      mobileLabel: "Tablica",
      description: "Pytania i odpowiedzi z działem zakupów",
      icon: "board",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.salesTablica,
    },
  ];

  const groups: NavGroup[] = [
    { title: NAV_SECTION_DAILY, items: dailyItems },
    { title: NAV_SECTION_ZK, items: zkItems },
    { title: NAV_SECTION_INFO, items: infoItems },
  ];

  if (isSalesManager(role)) {
    const teamNav = salesManagerNavTeamDescriptions();
    groups.push({
      title: NAV_SECTION_TEAM,
      items: [
        {
          href: "/zespol",
          label: "Podgląd zespołu",
          mobileLabel: "Zespół",
          description: teamNav.overview,
          icon: "team",
          tone: "slate",
          tier: "compact",
          mobileSlot: "overflow",
        },
        {
          href: "/zespol/handlowcy",
          label: "Handlowcy",
          description: teamNav.handlowcy,
          icon: "teamAccounts",
          tone: "slate",
          tier: "compact",
          mobileSlot: "overflow",
        },
        {
          href: "/zespol/grupy",
          label: "Grupy",
          description: teamNav.grupy,
          icon: "teamGroups",
          tone: "slate",
          tier: "compact",
          mobileSlot: "overflow",
        },
        {
          href: "/zespol/urlopy",
          label: "Urlopy",
          description: teamNav.urlopy,
          icon: "vacation",
          tone: "slate",
          tier: "compact",
          mobileSlot: "overflow",
        },
      ],
    });
  }

  if (!isSalesManager(role)) {
    groups.push({
      title: NAV_SECTION_TEAM,
      items: [
        {
          href: "/zespol/urlopy",
          label: "Urlopy",
          description: "Kalendarz urlopów Twojej grupy",
          icon: "vacation",
          tone: "slate",
          tier: "compact",
          mobileSlot: "overflow",
        },
      ],
    });
  }

  return groups;
}

/** @deprecated użyj navForRole */
export const adminNav = navForRole("admin");
export const salesNav = navForRole("sales");

export function pageTitle(pathname: string): string {
  if (pathname.includes("/nieaktywni")) return "Nieaktywni dostawcy";
  if (pathname.startsWith("/admin/dostawcy") || pathname.startsWith("/zakupy/dostawcy")) {
    return "Karty dostawców";
  }
  if (pathname.startsWith("/admin/urlopy") || pathname.startsWith("/zakupy/urlopy")) {
    return "Urlopy";
  }
  if (pathname.startsWith("/lokalizacje/")) return "Terminy zamówień";
  if (pathname.startsWith("/zeby/przyjecie")) return "Przyjęcie";
  if (pathname.startsWith("/zeby/kolejka")) return "Kolejka";
  if (pathname.startsWith("/zeby/weryfikacja")) return "Weryfikacja zębów";
  if (pathname.startsWith("/zeby/historia")) return "Historia";
  if (pathname.startsWith("/zeby")) return "Kolejka";

  for (const role of ["admin", "zakupy", "zakupy_zeby", "magazyn", "sales", "sales_manager"] as const) {
    for (const g of navForRole(role)) {
      const hrefs = g.items.map((i) => i.href);
      const matches = g.items.filter((i) => isNavItemActive(pathname, i.href, hrefs));
      const hit = matches.sort((a, b) => b.href.length - a.href.length)[0];
      if (hit) return hit.label;
    }
  }
  if (pathname.startsWith("/zk")) return "ZK czekające";
  if (pathname.startsWith("/notatnik")) return "Notatnik";
  if (pathname.startsWith("/notatki")) return "Notatki";
  if (pathname.startsWith("/ustawienia")) return "Ustawienia";
  if (pathname.startsWith("/zespol")) {
    if (pathname.startsWith("/zespol/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/zespol/grupy")) return "Grupy";
    if (pathname.startsWith("/zespol/urlopy")) return "Urlopy";
    return "Podgląd zespołu";
  }
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/uzytkownicy")) return "Konta";
    if (pathname.startsWith("/admin/zgloszenia")) return "Zgłoszenia";
    if (pathname.startsWith("/admin/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/admin/produkty/zeby")) return "Produkty zębne";
    if (pathname.startsWith("/admin/produkty")) return "Katalog produktów";
    return "Administracja";
  }
  if (pathname === "/login") return "Logowanie";
  return "OnTime";
}

export function sidebarSubtitle(role: UserRole): string {
  return ROLE_LABELS[role];
}
