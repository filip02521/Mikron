import type { UserRole } from "@/types/database";
import { isSalesManager } from "@/lib/auth-roles";
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
 * Gdy href zawiera query string (np. /zeby?tab=harmonogram), sprawdza też activeSearch.
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

function teethTodayItems(badges: {
  teethQueue?: number;
}): NavItem[] {
  return [
    {
      href: "/zeby",
      label: "Panel zębów",
      mobileLabel: "Zęby",
      description: "Kolejka zamówień na zęby",
      icon: "teeth",
      tone: "indigo",
      tier: "primary",
      highlight: true,
      mobileSlot: "primary",
      badge: badges.teethQueue,
    },
    {
      href: "/zeby?tab=harmonogram",
      label: "Harmonogram",
      mobileLabel: "Harmonogram",
      description: "Cykliczny plan dostawców zębów",
      icon: "schedule",
      tone: "sky",
      tier: "primary",
      mobileSlot: "primary",
    },
  ];
}

function operationsTodayItems(badges: {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
  teethQueue?: number;
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
      href: "/zeby",
      label: "Panel zębów",
      mobileLabel: "Zęby",
      description: "Kolejka zamówień na zęby",
      icon: "teeth",
      tone: "indigo",
      tier: "compact",
      indent: true,
      mobileSlot: "overflow",
      badge: badges.teethQueue,
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

  if (role === "zakupy_zeby") {
    return [
      {
        href: "/zakupy/dostawcy",
        label: "Karty dostawców",
        description: "Kontakt i dane dostawców",
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

function operationsNavGroups(
  role: UserRole,
  badges: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    teethQueue?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
    adminBugReports?: number;
  }
): NavGroup[] {
  if (role === "zakupy_zeby") {
    return [
      { title: NAV_SECTION_TODAY, items: teethTodayItems(badges) },
      { title: NAV_SECTION_TEAM, items: operationsTeamItems(badges) },
    ];
  }

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
    /** Przypomnienia ZK z follow-up na dziś/wcześniej (/zk). */
    salesZkDue?: number;
    /** Przypomnienia notatek z follow-up na dziś/wcześniej (/notatnik). */
    salesNotesDue?: number;
    /** Przypomnienia w notatkach zakupów/magazynu (/notatki). */
    operationsNotatki?: number;
    /** Otwarte zgłoszenia od handlowców (/admin/zgloszenia). */
    adminBugReports?: number;
    /** Nowe odpowiedzi zakupów na /tablica (pytania zespołu). */
    salesTablica?: number;
    /** Pytania handlowców bez odpowiedzi (/zakupy/tablica). */
    departmentBoardQuestions?: number;
    /** Pozycje zębów oczekujące na zamówienie (/zeby). */
    teethQueue?: number;
  } = {}
): NavGroup[] {
  if (role === "admin" || role === "zakupy" || role === "zakupy_zeby") {
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
        ],
      },
    ];
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
  if (pathname.startsWith("/zk")) return "ZK czekające";
  if (pathname.startsWith("/notatnik")) return "Notatnik";
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
