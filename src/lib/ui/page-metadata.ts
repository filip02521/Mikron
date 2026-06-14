import type { Metadata } from "next";
import { ONTIME_APP_DESCRIPTION, ONTIME_APP_NAME } from "@/lib/ui/ontime-brand";

/** Tytuł zakładki: „Moje zamówienia · OnTime”. */
export function pageMetadata(title: string, description?: string): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
  };
}

export const PAGE_TITLES = {
  home: "Start",
  login: "Logowanie",
  entering: "Wejście do panelu",
  setup: "Konfiguracja",
  setPassword: "Ustaw hasło",
  moje: "Moje zamówienia",
  prosba: "Nowa prośba",
  plan: "Harmonogram",
  notatnik: "ZK czekające",
  tablica: "Tablica",
  podsumowanie: "Panel dzienny",
  kolejka: "Przyjęcie towaru",
  weryfikacja: "Weryfikacja",
  historia: "Historia",
  notatki: "Notatki działu",
  noweZamowienia: "Nowe zamówienia",
  admin: "Administracja",
  adminUsers: "Konta użytkowników",
  adminSales: "Handlowcy",
  adminSuppliers: "Dostawcy",
  adminProducts: "Katalog produktów",
  adminVacations: "Urlopy",
  adminReports: "Zgłoszenia",
  procurementBoard: "Tablica",
  procurementSuppliers: "Dostawcy",
  procurementVacations: "Urlopy",
  inactiveSuppliers: "Nieaktywni dostawcy",
  team: "Zespół",
  teamSales: "Handlowcy zespołu",
  teamGroups: "Grupy handlowe",
  locations: "Lokalizacje",
} as const;

export const PAGE_DESCRIPTIONS: Partial<Record<keyof typeof PAGE_TITLES, string>> = {
  moje: "Status Twoich prośb i odbiór dostaw — OnTime · Mikran",
  prosba: "Zgłoś prośbę o zamówienie lub informację o braku na stanie",
  tablica: ONTIME_APP_DESCRIPTION,
  podsumowanie: "Kolejka dnia, prośby handlowców i harmonogram dostawców",
  kolejka: "Przyjęcie towaru i kolejka realizacji magazynu",
  admin: "Konfiguracja systemu, użytkownicy i narzędzia serwisowe",
};

export function pageMetadataFor(
  key: keyof typeof PAGE_TITLES,
  overrides?: { title?: string; description?: string }
): Metadata {
  const title = overrides?.title ?? PAGE_TITLES[key];
  const description = overrides?.description ?? PAGE_DESCRIPTIONS[key];
  return pageMetadata(title, description);
}

export const defaultAppMetadata: Metadata = {
  title: {
    default: ONTIME_APP_NAME,
    template: `%s · ${ONTIME_APP_NAME}`,
  },
  description: ONTIME_APP_DESCRIPTION,
  applicationName: ONTIME_APP_NAME,
  /** Ikony: `app/icon.svg` + `app/apple-icon.tsx` (konwencja Next.js, dziedziczone przez wszystkie strony). */
};
