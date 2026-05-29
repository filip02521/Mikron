import type { UserRole } from "@/types/database";
import { canManageSalesTeam, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { salesManagerNavTeamDescriptions } from "@/lib/sales/team-ui";

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
 * Czy punkt menu jest aktywny.
 * Nie podświetla krótszego href (np. /zespol), gdy pathname pasuje do dokładniejszego siblinga (/zespol/handlowcy).
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: string[] = []
): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

function operationsNavItems(badges: {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
}): NavItem[] {
  return [
    {
      href: "/podsumowanie",
      label: "Panel dzienny",
      description: "Przegląd dnia, prośby i harmonogram",
      badge: badges.nowe,
    },
    {
      href: "/weryfikacja",
      label: "Weryfikacja",
      description: "Prośby bez dostawcy lub towaru — uzupełnij dane",
      badge: badges.weryfikacja,
    },
    {
      href: "/kolejka",
      label: "Magazyn i regał",
      description: "Przyjęcie dostaw i informacje",
      badge: badges.realizacja,
    },
    {
      href: "/historia",
      label: "Historia",
      description: "Przegląd zamówień",
    },
  ];
}

const supplierHubItems: NavItem[] = [
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

const orderFormItems: NavItem[] = [
  {
    href: "/zamowienia/nowe",
    label: "Zamówienie grupowe",
    description: "Formularz zbiorczy",
  },
];

const adminOnlyItems: NavItem[] = [
  {
    href: "/admin",
    label: "Administracja",
    description: "System, konta, handlowcy",
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

export function navForRole(
  role: UserRole,
  badges: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    /** Aktywne karty wymagające uwagi handlowca (/moje). */
    salesMoje?: number;
    /** Aktywne ZK oczekujące na zapłatę (/notatnik). */
    salesNotatnik?: number;
  } = {}
): NavGroup[] {
  const ops = operationsNavItems(badges);
  if (role === "admin") {
    return [
      { title: "Dzień roboczy", items: ops },
      { title: "Dostawcy", items: supplierHubItems },
      { title: "Formularze", items: orderFormItems },
      { title: "Administracja", items: adminOnlyItems },
    ];
  }

  if (role === "zakupy") {
    return [
      { title: "Dzień roboczy", items: ops },
      { title: "Dostawcy", items: supplierHubItems },
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
        ],
      },
    ];
  }

  const handlowiecItems: NavItem[] = [
    {
      href: "/moje",
      label: "Moje zamówienia",
      mobileLabel: "Moje",
      description: "Statusy i odbiór",
      badge: badges.salesMoje,
    },
    {
      href: "/prosba",
      label: "Nowa prośba",
      mobileLabel: "Prośba",
      description: "Jeden formularz — zamówienie lub dostępność",
    },
    {
      href: "/plan",
      label: "Harmonogram zakupów",
      mobileLabel: "Plan",
      description: "Terminy, otwarte prośby i wyszukiwarka",
    },
    {
      href: "/notatnik",
      label: "Notatnik",
      mobileLabel: "Notatnik",
      description: "ZK na zapłatę i własne notatki",
      badge: badges.salesNotatnik,
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
  for (const role of ["admin", "zakupy", "magazyn", "sales", "sales_manager"] as const) {
    for (const g of navForRole(role)) {
      const hrefs = g.items.map((i) => i.href);
      const matches = g.items.filter((i) => isNavItemActive(pathname, i.href, hrefs));
      const hit = matches.sort((a, b) => b.href.length - a.href.length)[0];
      if (hit) return hit.label;
    }
  }
  if (pathname.startsWith("/lokalizacje/")) return "Terminy zamówień";
  if (pathname.startsWith("/notatnik")) return "Notatnik";
  if (pathname.startsWith("/zespol")) {
    if (pathname.startsWith("/zespol/handlowcy")) return "Handlowcy i konta";
    if (pathname.startsWith("/zespol/grupy")) return "Grupy zespołu";
    return "Podgląd zespołu";
  }
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/uzytkownicy")) return "Konta";
    if (pathname.startsWith("/admin/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/admin/produkty")) return "Katalog produktów";
    if (pathname.startsWith("/admin/dostawcy")) return "Karty dostawców";
    if (pathname.startsWith("/admin/urlopy")) return "Urlopy";
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
