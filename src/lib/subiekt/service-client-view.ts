import type { SubiektKontrahent } from "@/lib/subiekt/types";

/**
 * Kontrahent dla roli serwis: tylko to, czego używa przyjęcie sprzętu (nazwa, miejscowość, telefon).
 * Bez NIP-u, e-maila, adresu i reszty rekordu — serwisant nie ma dostępu do danych kontrahentów poza tym.
 */
export function serviceClientView(k: SubiektKontrahent): SubiektKontrahent {
  return {
    kh_Id: k.kh_Id,
    kh_Symbol: k.kh_Symbol ?? null,
    adr_Nazwa: k.adr_Nazwa ?? null,
    adr_NazwaPelna: k.adr_NazwaPelna ?? null,
    adr_Miejscowosc: k.adr_Miejscowosc ?? null,
    adr_Telefon: k.adr_Telefon ?? null,
    kh_Telefon: k.kh_Telefon ?? null,
  };
}
