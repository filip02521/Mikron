/**
 * PostHog (EU) — wspólna konfiguracja. Import: serwer i klient.
 * Klucz projektu (phc_) jest z założenia jawny (trafia do przeglądarki), więc stoi w kodzie:
 * produkcja działa bez ręcznego kroku na serwerze. Zmiana projektu: NEXT_PUBLIC_POSTHOG_KEY.
 */
export const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "phc_kgCsVTWmJhZPGe3d7bWpuAt4DVDDH4hGWxNuYYfwVUfY";

// shortcut: bez reverse proxy (/ingest) — adblock w przeglądarce pracownika gubi jego zdarzenia; proxy, gdy zabraknie danych z czyjegoś komputera.
export const POSTHOG_HOST = "https://eu.i.posthog.com";

/** Adres bez query (?dla=, ?q=…) — w parametrach bywają wyszukiwane nazwy klientów. */
export function stripQuery(url: unknown): unknown {
  return typeof url === "string" ? url.split("?")[0] : url;
}
