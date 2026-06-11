import type { UserRole } from "@/types/database";
import { isSalesManager } from "@/lib/auth-roles";
import { salesManagerNavTeamDescriptions } from "@/lib/sales/team-ui";
import { supplierHubPaths } from "@/lib/supplier-hub";

export type NavItem = {
  href: string;
  label: string;
  /** Krótsza etykieta w dolnej nawigacji mobilnej. */
  mobileLabel?: string;
  description?: string;
  badge?: number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

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

/**
 * Czy punkt menu jest aktywny.
 * Nie podświetla krótszego href (np. /zespol), gdy pathname pasuje do dokładniejszego siblinga (/zespol/handlowcy).
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: string[] = []
): boolean {
  if (href === "/admin") {
    return isAdminSidebarRootActive(pathname);
  }
  if (href === "/zk") {
    return (
      pathname === "/zk" ||
      pathname === "/notatnik" ||
      pathname.startsWith("/notatnik/")
    );
  }
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (href.endsWith("/dostawcy") && pathname.includes("/nieaktywni")) return false;
  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

const OPERATIONS_NOTATKI_PATH = "/notatki";
/** Magazyn — jawny dział w URL (zakupy/admin domyślnie bez parametru). */
const OPERATIONS_NOTATKI_MAGAZYN = "/notatki?dzial=magazyn";

const DEPARTMENT_BOARD_PROCUREMENT_PATH = "/zakupy/tablica";

function operationsNavItems(badges: {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
  operationsNotatki?: number;
  /** Pytania handlowców bez odpowiedzi (/zakupy/tablica). */
  departmentBoardQuestions?: number;
}): NavItem[] {
  return [
    {
      href: "/podsumowanie",
      label: "Panel dzienny",
      mobileLabel: "Panel",
      description: "Zacznij tu — kolejka dnia, prośby i harmonogram",
      badge: badges.nowe,
    },
    {
      href: OPERATIONS_NOTATKI_PATH,
      label: "Notatki",
      mobileLabel: "Notatki",
      description: "Prywatne i wspólne",
      badge: badges.operationsNotatki,
    },
    {
      href: DEPARTMENT_BOARD_PROCUREMENT_PATH,
      label: "Tablica z handlowcami",
      mobileLabel: "Handlowcy",
      description: "Ogłoszenia dla zespołu i odpowiedzi na pytania",
      badge: badges.departmentBoardQuestions,
    },
    {
      href: "/weryfikacja",
      label: "Weryfikacja",
      mobileLabel: "Weryfik.",
      description: "Uzupełnij brakujące dane prośby",
      badge: badges.weryfikacja,
    },
    {
      href: "/kolejka",
      label: "Magazyn i regał",
      mobileLabel: "Magazyn",
      description: "Po zamówieniu u dostawcy — przyjęcie towaru",
      badge: badges.realizacja,
    },
    {
      href: "/historia",
      label: "Historia",
      mobileLabel: "Historia",
      description: "Archiwum złożonych zamówień",
    },
  ];
}

const supplierHubItemsZakupy: NavItem[] = [
  {
    href: "/zakupy/dostawcy",
    label: "Karty dostawców",
    description: "Kontakt, zapas, częstotliwość",
  },
  {
    href: "/lokalizacje/POLSKA",
    label: "Terminy zamówień",
    description: "Daty cyklu · PL / ZA / Import",
  },
  {
    href: "/zakupy/urlopy",
    label: "Urlopy",
    description: "Okresy niedostępności",
  },
];

function supplierHubItemsForRole(role: UserRole): NavItem[] {
  if (role !== "admin") return supplierHubItemsZakupy;
  const paths = supplierHubPaths("admin");
  return [
    {
      href: paths.cards,
      label: "Karty dostawców",
      description: "Kontakt, zapas, częstotliwość · usuwanie",
    },
    {
      href: paths.schedule("POLSKA"),
      label: "Terminy zamówień",
      description: "Daty cyklu · PL / ZA / Import",
    },
    {
      href: paths.vacations,
      label: "Urlopy",
      description: "Okresy niedostępności",
    },
  ];
}

const orderFormItems: NavItem[] = [
  {
    href: "/zamowienia/nowe",
    label: "Zamówienie grupowe",
    description: "Formularz zbiorczy",
  },
];

const adminOnlyItemsBase: NavItem[] = [
  {
    href: "/admin",
    label: "Administracja",
    description: "System, konta, handlowcy",
  },
  {
    href: "/admin/zgloszenia",
    label: "Zgłoszenia handlowców",
    description: "Błędy i uwagi od zespołu sprzedaży",
  },
  {
    href: "/admin/produkty",
    label: "Katalog produktów",
    description: "Towar Subiekt → dostawca",
  },
  {
    href: "/zespol/grupy",
    label: "Grupy zespołu",
    description: "Sklep, Biuro — tworzenie i kolejność",
  },
];

function adminNavItems(badges: { adminBugReports?: number }): NavItem[] {
  return adminOnlyItemsBase.map((item) =>
    item.href === "/admin/zgloszenia"
      ? { ...item, badge: badges.adminBugReports }
      : item
  );
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
  const ops = operationsNavItems(badges);
  if (role === "admin") {
    return [
      { title: "Dzień roboczy", items: ops },
      { title: "Dostawcy", items: supplierHubItemsForRole(role) },
      { title: "Formularze", items: orderFormItems },
      { title: "Administracja", items: adminNavItems(badges) },
    ];
  }

  if (role === "zakupy") {
    return [
      { title: "Dzień roboczy", items: ops },
      { title: "Dostawcy", items: supplierHubItemsForRole(role) },
      { title: "Formularze", items: orderFormItems },
    ];
  }

  if (role === "magazyn") {
    return [
      {
        title: "Magazyn",
        items: [
          {
            href: "/kolejka",
            label: "Magazyn i regał",
            description: "Przyjęcie towaru i dziennik dostaw",
            badge: badges.realizacja,
          },
          {
            href: OPERATIONS_NOTATKI_MAGAZYN,
            label: "Notatki",
            mobileLabel: "Notatki",
            description: "Prywatne i wspólne dla magazynu",
            badge: badges.operationsNotatki,
          },
        ],
      },
    ];
  }

  const handlowiecItems: NavItem[] = [
    {
      href: "/moje",
      label: "Moje zamówienia",
      mobileLabel: "Moje",
      description: "Start dnia, statusy prośb i odbiór",
      badge: badges.salesMoje,
    },
    {
      href: "/prosba",
      label: "Nowa prośba",
      mobileLabel: "Prośba",
      description:
        "Zamówienie u dostawcy lub info o dostępności — status w Moje zamówienia (nie pytanie ogólne)",
    },
    {
      href: "/zk",
      label: "ZK czekające",
      mobileLabel: "ZK",
      description: "ZK czekające na towar z Subiekta — śledzenie dostaw i prośby z pozycji",
      badge: badges.salesNotatnik,
    },
    {
      href: "/plan",
      label: "Harmonogram zakupów",
      mobileLabel: "Plan",
      description: "Terminy u dostawców, otwarte prośby i wyszukiwarka",
    },
    {
      href: "/tablica",
      label: "Komunikacja",
      mobileLabel: "Info",
      description: "Ogłoszenia i pytania do zakupów — bez składania prośby o towar",
      badge: badges.salesTablica,
    },
  ];

  const groups: NavGroup[] = [{ title: "Handlowiec", items: handlowiecItems }];

  if (isSalesManager(role)) {
    const teamNav = salesManagerNavTeamDescriptions();
    groups.push({
      title: "Zespół",
      items: [
        {
          href: "/zespol",
          label: "Podgląd zespołu",
          mobileLabel: "Zespół",
          description: teamNav.overview,
        },
        {
          href: "/zespol/handlowcy",
          label: "Handlowcy i konta",
          description: teamNav.handlowcy,
        },
        {
          href: "/zespol/grupy",
          label: "Przypisane grupy",
          description: teamNav.grupy,
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
    if (pathname.startsWith("/zespol/handlowcy")) return "Handlowcy i konta";
    if (pathname.startsWith("/zespol/grupy")) return "Grupy zespołu";
    return "Podgląd zespołu";
  }
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/uzytkownicy")) return "Konta";
    if (pathname.startsWith("/admin/zgloszenia")) return "Zgłoszenia handlowców";
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
