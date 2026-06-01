import { INFORMACJA_NO_QUANTITY } from "@/lib/orders/individual";

/** W arkuszu / historii: „-” (lub puste) = prośba informacyjna, nie zamówienie u dostawcy. */
export function isInformacjaQuantityMarker(quantity?: string | null): boolean {
  const t = quantity?.trim();
  if (!t) return true;
  const normalized = t.replace(/[\u2013\u2014]/g, "-");
  return normalized === INFORMACJA_NO_QUANTITY;
}

const STAN_SHEET_ALIASES = new Set(["STAN", "NA STAN"]);

/** Etykieta z kolumny DLA KOGO / HANDLOWIEC oznacza handlowca STAN (magazyn). */
export function isStanSalesPersonLabel(rawPerson?: string | null): boolean {
  const trimmed = rawPerson?.trim();
  if (!trimmed) return false;
  const segments = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
  for (const segment of segments) {
    if (STAN_SHEET_ALIASES.has(segment.toUpperCase())) return true;
  }
  return STAN_SHEET_ALIASES.has(trimmed.toUpperCase());
}

export type InformacjaOnlyInput = {
  quantity?: string | null;
  personLabel?: string | null;
  salesPersonId?: string | null;
  stanSalesPersonId?: string | null;
};

/** Wiersz historii / zgłoszenie traktujemy wyłącznie jako informację o dostępności. */
export function shouldTreatAsInformacjaOnly(input: InformacjaOnlyInput): boolean {
  if (isInformacjaQuantityMarker(input.quantity)) return true;
  if (isStanSalesPersonLabel(input.personLabel)) return true;
  if (
    input.salesPersonId &&
    input.stanSalesPersonId &&
    input.salesPersonId === input.stanSalesPersonId
  ) {
    return true;
  }
  return false;
}
