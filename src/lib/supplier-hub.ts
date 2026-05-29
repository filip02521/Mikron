import type { SupplierLocation } from "@/types/database";

export type SupplierHubTab = "cards" | "schedules" | "vacations" | "inactive";
export type SupplierHubContext = "zakupy" | "admin";

export function supplierHubPaths(ctx: SupplierHubContext) {
  const base = ctx === "admin" ? "/admin" : "/zakupy";
  return {
    cards: `${base}/dostawcy`,
    inactive: `${base}/dostawcy/nieaktywni`,
    vacations: `${base}/urlopy`,
    schedule: (location: SupplierLocation) => `/lokalizacje/${location}`,
  };
}

export function activeSupplierHubTab(pathname: string): SupplierHubTab {
  if (pathname.includes("/nieaktywni")) return "inactive";
  if (pathname.includes("/urlopy")) return "vacations";
  if (pathname.startsWith("/lokalizacje/")) return "schedules";
  return "cards";
}

export function scheduleLocationFromPath(pathname: string): SupplierLocation {
  const seg = pathname.split("/").pop()?.toUpperCase();
  if (seg === "ZAGRANICA" || seg === "IMPORT") return seg;
  return "POLSKA";
}

export const SUPPLIER_HUB_TAB_COPY: Record<
  SupplierHubTab,
  { label: string; hint: string }
> = {
  cards: {
    label: "Karty dostawców",
    hint: "Nazwa, kontakt, zapas i częstotliwość — bez edycji dat",
  },
  schedules: {
    label: "Terminy zamówień",
    hint: "Ostatnie, następne i przesunięcie — tylko daty w cyklu",
  },
  vacations: {
    label: "Urlopy",
    hint: "Okresy niedostępności — wpływ na wyliczone terminy",
  },
  inactive: {
    label: "Nieaktywni",
    hint: "Ukryci w panelu dziennym — przywrócenie aktywności",
  },
};

export function supplierHubHint(tab: SupplierHubTab): string {
  switch (tab) {
    case "cards":
      return "Stałe dane karty dostawcy (kontakt, zapas, jak często zamawiamy). Terminy w cyklu edytujesz w zakładce Terminy zamówień.";
    case "schedules":
      return "Wyłącznie daty w harmonogramie cyklicznym. Zapas, kontakt i częstotliwość zmieniasz w Kartach dostawców — po zapisie system przelicza terminy.";
    case "vacations":
      return "Urlop wpływa na wyliczone daty. Pojedyncze korekty terminów nadal robisz w Terminach zamówień.";
    case "inactive":
      return "Nieaktywni dostawcy nie pojawiają się w panelu dziennym ani w planie tygodnia. Terminy w harmonogramie widać z oznaczeniem „Nieaktywny”.";
  }
}
