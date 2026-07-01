import type { SupplierLocation } from "@/types/database";
import type { UserRole } from "@/types/database";
import type { SupplierSubiektFilter } from "@/lib/supplier-locations";

export type SupplierHubTab = "cards" | "schedules" | "vacations" | "inactive";
export type SupplierHubContext = "zakupy" | "admin";

export function supplierHubContextForRole(role: UserRole | null | undefined): SupplierHubContext {
  return role === "admin" ? "admin" : "zakupy";
}

export function supplierHubPaths(
  ctx: SupplierHubContext,
  opts?: { teethLane?: boolean }
) {
  const base = ctx === "admin" ? "/admin" : "/zakupy";
  const teethQuery = opts?.teethLane ? "?tor=zeby" : "";
  return {
    cards: `${base}/dostawcy${teethQuery}`,
    inactive: `${base}/dostawcy/nieaktywni`,
    vacations: `${base}/urlopy`,
    schedule: (location: SupplierLocation) => `/lokalizacje/${location}`,
  };
}

export function supplierCardsHref(
  ctx: SupplierHubContext,
  opts?: { q?: string; powiaz?: boolean; subiekt?: SupplierSubiektFilter }
): string {
  const base = supplierHubPaths(ctx).cards;
  const params = new URLSearchParams();
  const q = opts?.q?.trim();
  if (q) params.set("q", q);
  if (opts?.powiaz) params.set("powiaz", "1");
  if (opts?.subiekt && opts.subiekt !== "all") params.set("subiekt", opts.subiekt);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function supplierVacationsHref(ctx: SupplierHubContext): string {
  return supplierHubPaths(ctx).vacations;
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

export const SUPPLIER_HUB_LIST_META_DESCRIPTION =
  "Brak Subiekt na górze. Filtry zapisują się w URL.";

/** Krótki opis w nagłówku karty huba — jeden blok, bez powtórzeń pod zakładkami. */
export function supplierHubShellDescription(
  tab: SupplierHubTab,
  context: SupplierHubContext
): string {
  switch (tab) {
    case "cards":
      return context === "admin"
        ? "Kontakt, cykl i częstotliwość — bez dat. Terminy w zakładce obok · tutaj możliwe trwałe usuwanie."
        : "Kontakt, cykl i częstotliwość — bez dat. Terminy w zakładce obok.";
    case "schedules":
      return "Daty w harmonogramie. Ustawienia karty — w Kartach dostawców.";
    case "vacations":
      return "Okresy niedostępności dostawców — wpływ na wyliczone terminy.";
    case "inactive":
      return "Ukryci w panelu dziennym. Przywróć aktywność lub edytuj terminy w harmonogramie.";
  }
}
