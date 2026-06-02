/** Skróty z arkusza → nazwa karty handlowca (współdzielone z importem CSV). */
export const SALES_SHEET_ALIASES: Record<string, string> = {
  "KASIA J": "Kasia J.",
  "KASIA J.": "Kasia J.",
  "OLA G.": "Ola G.",
  "OLA G": "Ola G.",
  "OLA SZ.": "Ola Sz.",
  "OLA S.": "Ola S.",
  "OLA K.": "Ola K.",
  "KASIA K.": "Kasia K.",
  "K.J.": "Kasia J.",
  "NA STAN": "STAN",
  MADZIA: "Magda",
  "K.J": "Kasia J.",
  "OLA K": "Ola K.",
  "OLA SZ": "Ola Sz.",
  "OLA STU": "Ola Sz.",
  SZYMON: "Szymon R.",
  ALINA: "Ala",
  "KAMIL W": "Kamil",
};

const SKIP_ALIASES = new Set(["", "-", "—"]);

export function normalizeSalesAlias(raw: string): string | null {
  const trimmed = raw.trim();
  if (SKIP_ALIASES.has(trimmed)) return null;
  if (/^\d+$/.test(trimmed)) return null;
  const upper = trimmed.toUpperCase();
  return SALES_SHEET_ALIASES[upper] ?? trimmed;
}
