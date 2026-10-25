/**
 * Kraj dostawcy z kartoteki Subiekta (`adr_IdPanstwo`, `adr_Panstwo`). Bez I/O — serwer i klient.
 * Zapis: `src/lib/data/supplier-country-sync.ts`.
 */
import { SUBIEKT_COUNTRY_ID_POLAND, ZD_AUTOMAT_SUPPLIER_LOCATION } from "@/lib/orders/zd-automat-contract";

export type SubiektCountry = { id: number; name: string | null };

/** null = Subiekt nie podał kraju (pusty odczyt) — nie nadpisuje zapisanej wartości. */
export function subiektCountryFromKontrahent(
  k: { adr_IdPanstwo?: unknown; adr_Panstwo?: unknown } | null | undefined
): SubiektCountry | null {
  const id = Number(k?.adr_IdPanstwo);
  if (!Number.isInteger(id) || id <= 0) return null;
  const name = typeof k?.adr_Panstwo === "string" ? k.adr_Panstwo.trim() : "";
  return { id, name: name || null };
}

export function isPolandCountryId(id: number | null | undefined): boolean {
  return id === SUBIEKT_COUNTRY_ID_POLAND;
}

/** „Polska”, „Niemcy”; bez odczytu — null (karta pokazuje, że kraj jeszcze nieznany). */
export function supplierCountryLabel(id: number | null | undefined, name: string | null | undefined): string | null {
  if (id == null) return null;
  if (isPolandCountryId(id)) return "Polska";
  return name?.trim() || `kraj nr ${id}`;
}

/**
 * Kraj z adresu w Subiekcie nie zgadza się z Lokalizacją w OnTime (Polska vs reszta). Automat ZD liczy
 * „polskich” wg Lokalizacji — rozjazd to sygnał do sprawdzenia karty, nie błąd. Brak któregoś z pól = brak rozjazdu.
 */
export function supplierCountryMismatchesLocation(countryId: number | null | undefined, location: string | null | undefined): boolean {
  if (countryId == null || !location) return false;
  return (location === ZD_AUTOMAT_SUPPLIER_LOCATION) !== isPolandCountryId(countryId);
}
