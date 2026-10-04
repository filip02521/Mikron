/**
 * Nomenklatura Scalona (CN) — słownik obowiązujących kodów 8-cyfrowych z opisami
 * (GUS, „self-explanatory texts”). Tylko serwer: plik JSON ma ~1,6 MB.
 * Aktualizacja raz w roku: `npx tsx scripts/build-cn-nomenclature.ts <plik.xlsx> <rok>`.
 */

import nomenclature from "./cn-nomenclature.json";

type Nomenclature = { year: number; codes: Record<string, string>; headings: Record<string, string> };

const CN = nomenclature as Nomenclature;

export const CN_YEAR = CN.year;

export type CnLookup = {
  /** null = kodu nie ma w słowniku CN {@link CN_YEAR}. */
  describe(code: string): string | null;
  /** Istniejące kody tej samej podpozycji (6 cyfr), a gdy brak — pozycji (4 cyfry); max 6. */
  siblings(code: string): string[];
  /** true = brak kodu w słowniku blokuje zatwierdzenie (słownik jest z bieżącego roku). */
  strict: boolean;
  year: number;
};

export function cnDescription(code: string | null | undefined): string | null {
  return code ? (CN.codes[code] ?? null) : null;
}

export function cnHeadingText(heading4: string): string | null {
  return CN.headings[heading4] ?? null;
}

/** Kody 8-cyfrowe zaczynające się od prefiksu (np. pozycja „8482” albo podpozycja „848210”). */
export function cnLeaves(prefix: string): { code: string; text: string }[] {
  const out: { code: string; text: string }[] = [];
  for (const [code, text] of Object.entries(CN.codes)) if (code.startsWith(prefix)) out.push({ code, text });
  return out;
}

export function cnSiblings(code: string): string[] {
  const six = cnLeaves(code.slice(0, 6));
  return (six.length ? six : cnLeaves(code.slice(0, 4))).slice(0, 6).map((l) => l.code);
}

export function createCnLookup(now = new Date()): CnLookup {
  return {
    describe: cnDescription,
    siblings: cnSiblings,
    // Słownik z poprzedniego roku może nie znać nowych kodów — wtedy tylko ostrzegamy.
    strict: now.getFullYear() <= CN.year,
    year: CN.year,
  };
}

export { formatCnCode } from "./customs-clearance";
