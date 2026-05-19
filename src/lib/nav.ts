import type { UserRole } from "@/types/database";

export type NavItem = {
  href: string;
  label: string;
  description?: string;
  badge?: number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

function operationsNavItems(badges: {
  nowe?: number;
  weryfikacja?: number;
  realizacja?: number;
}): NavItem[] {
  return [
    {
      href: "/podsumowanie",
      label: "Panel dzienny",
      description: "Prośby handlowców, zaległe, plan tygodnia",
      badge: badges.nowe,
    },
    {
      href: "/weryfikacja",
      label: "Weryfikacja",
      description: "Uzupełnianie danych w prośbach",
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
];

export function navForRole(
  role: UserRole,
  badges: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    /** Aktywne karty wymagające uwagi handlowca (/moje). */
    salesMoje?: number;
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

  return [
    {
      title: "Handlowiec",
      items: [
        {
          href: "/moje",
          label: "Moje zamówienia",
          description: "Statusy i odbiór",
          badge: badges.salesMoje,
        },
        { href: "/prosba", label: "Nowa prośba", description: "Zgłoszenie do zakupów" },
        {
          href: "/plan",
          label: "Harmonogram zakupów",
          description: "Kalendarz działu dostaw · wyszukiwarka dostawców",
        },
      ],
    },
  ];
}

/** @deprecated użyj navForRole */
export const adminNav = navForRole("admin");
export const salesNav = navForRole("sales");

export function pageTitle(pathname: string): string {
  for (const role of ["admin", "zakupy", "sales"] as const) {
    for (const g of navForRole(role)) {
      const hit = g.items.find(
        (i) => pathname === i.href || pathname.startsWith(i.href + "/")
      );
      if (hit) return hit.label;
    }
  }
  if (pathname.startsWith("/lokalizacje/")) return "Terminy zamówień";
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/uzytkownicy")) return "Konta";
    if (pathname.startsWith("/admin/handlowcy")) return "Handlowcy";
    if (pathname.startsWith("/admin/dostawcy")) return "Karty dostawców";
    if (pathname.startsWith("/admin/urlopy")) return "Urlopy";
    return "Administracja";
  }
  if (pathname === "/login") return "Logowanie";
  return "System Dostaw";
}

export function sidebarSubtitle(role: UserRole): string {
  if (role === "admin") return "Administrator";
  if (role === "zakupy") return "Dział zakupów";
  return "Handlowiec";
}
