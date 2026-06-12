import type { UserRole } from "@/types/database";
import { isSalesManager } from "@/lib/auth-roles";
import { salesManagerNavTeamDescriptions } from "@/lib/sales/team-ui";
import { supplierHubPaths } from "@/lib/supplier-hub";

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
  | "teamGroups";

export type NavTone = "indigo" | "amber" | "emerald" | "sky" | "slate" | "violet";

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
  tier?: NavTier;
  /** Delikatne wyróżnienie punktu startowego (Panel / Moje). */
  highlight?: boolean;
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

/**
 * Czy punkt menu jest aktywny.
 * Nie podświetla krótszego href (np. /zespol), gdy pathname pasuje do dokładniejszego siblinga (/zespol/handlowcy).
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: string[] = []
): boolean {
  const hrefPath = navHrefPath(href);

  if (hrefPath === "/admin") {
    return isAdminSidebarRootActive(pathname);
  }
  if (hrefPath === "/zk") {
    return (
      pathname === "/zk" ||
      pathname === "/notatnik" ||
      pathname.startsWith("/notatnik/")
    );
  }
  if (hrefPath.startsWith("/lokalizacje/") && pathname.startsWith("/lokalizacje/")) {
    return true;
  }
  if (pathname === hrefPath) return true;
  if (!pathname.startsWith(`${hrefPath}/`)) return false;
  if (hrefPath.endsWith("/dostawcy") && pathname.includes("/nieaktywni")) return false;
  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      navHrefPath(other).startsWith(`${hrefPath}/`) &&
      (pathname === navHrefPath(other) || pathname.startsWith(`${navHrefPath(other)}/`))
  );
}

const OPERATIONS_NOTATKI_PATH = "/notatki";
/** Magazyn — jawny dział w URL (zakupy/admin domyślnie bez parametru). */
const OPERATIONS_NOTATKI_MAGAZYN = "/notatki?dzial=magazyn";

const DEPARTMENT_BOARD_PROCUREMENT_PATH = "/zakupy/tablica";

function operationsTodayItems(badges: {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
}): NavItem[] {
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
  ];
}

function supplierHubItemsForRole(role: UserRole): NavItem[] {
  const compact = {
    tier: "compact" as const,
    mobileSlot: "overflow" as const,
  };

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
      href: "/zespol/grupy",
      label: "Grupy",
      description: "Sklep, Biuro — kolejność",
      icon: "teamGroups",
      tone: "violet",
      ...compact,
    },
  ];
}

function operationsNavGroups(
  role: UserRole,
  badges: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
    adminBugReports?: number;
  }
): NavGroup[] {
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
  badges: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    /** Aktywne karty wymagające uwagi handlowca (/moje). */
    salesMoje?: number;
    /** ZK i notatki z przypomnieniem (/notatnik). */
    salesNotatnik?: number;
    /** Przypomnienia w notatkach zakupów/magazynu (/notatki). */
    operationsNotatki?: number;
    /** Otwarte zgłoszenia od handlowców (/admin/zgloszenia). */
    adminBugReports?: number;
    /** Nieprzeczytane ogłoszenia (/tablica). */
    salesTablica?: number;
    /** Pytania handlowców bez odpowiedzi (/zakupy/tablica). */
    departmentBoardQuestions?: number;
  } = {}
): NavGroup[] {
  if (role === "admin" || role === "zakupy") {
    return operationsNavGroups(role, badges);
  }

  if (role === "magazyn") {
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
        ],
      },
    ];
  }

  const dailyItems: NavItem[] = [
    {
      href: "/moje",
      label: "Moje zamówienia",
      mobileLabel: "Moje",
      description: "Statusy prośb i odbiór",
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
  ];

  const zkItems: NavItem[] = [
    {
      href: "/zk",
      label: "ZK czekające",
      mobileLabel: "ZK",
      description: "Towar z Subiekta",
      icon: "clientZk",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "primary",
      badge: badges.salesNotatnik,
    },
    {
      href: "/plan",
      label: "Harmonogram",
      mobileLabel: "Plan",
      description: "Terminy u dostawców",
      icon: "plan",
      tone: "indigo",
      tier: "primary",
      mobileSlot: "overflow",
    },
  ];

  const infoItems: NavItem[] = [
    {
      href: "/tablica",
      label: "Tablica",
      mobileLabel: "Tablica",
      description: "Ogłoszenia i pytania do zakupów",
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
          tone: "indigo",
          tier: "compact",
          mobileSlot: "overflow",
        },
        {
          href: "/zespol/handlowcy",
          label: "Handlowcy",
          description: teamNav.handlowcy,
          icon: "teamAccounts",
          tone: "indigo",
          tier: "compact",
          mobileSlot: "overflow",
        },
        {
          href: "/zespol/grupy",
          label: "Grupy",
          description: teamNav.grupy,
          icon: "teamGroups",
          tone: "indigo",
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

  for (const role of ["admin", "zakupy", "magazyn", "sales", "sales_manager"] as const) {
    for (const g of navForRole(role)) {
      const hrefs = g.items.map((i) => i.href);
      const matches = g.items.filter((i) => isNavItemActive(pathname, i.href, hrefs));
      const hit = matches.sort((a, b) => b.href.length - a.href.length)[0];
      if (hit) return hit.label;
    }
  }
  if (pathname.startsWith("/notatnik") || pathname.startsWith("/zk")) return "ZK czekające";
  if (pathname.startsWith("/notatki")) return "Notatki";
  if (pathname.startsWith("/zespol")) {
    if (pathname.startsWith("/zespol/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/zespol/grupy")) return "Grupy";
    return "Podgląd zespołu";
  }
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/uzytkownicy")) return "Konta";
    if (pathname.startsWith("/admin/zgloszenia")) return "Zgłoszenia";
    if (pathname.startsWith("/admin/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/admin/produkty")) return "Katalog produktów";
    return "Administracja";
  }
  if (pathname === "/login") return "Logowanie";
  return "OnTime";
}

export function sidebarSubtitle(role: UserRole): string {
  if (role === "admin") return "Administrator";
  if (role === "zakupy") return "Dział zakupów";
  if (role === "magazyn") return "Dział dostaw";
  if (isSalesManager(role)) return "Kierownik handlowców";
  return "Handlowiec";
}
