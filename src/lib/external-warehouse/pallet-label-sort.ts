/**
 * Porównanie etykiet palet Magazynu Gądki: 1, 2, …, 10 (nie 1, 10, 2).
 * Tekstowe (A/B) nadal alfabetycznie (pl).
 */
export function comparePalletLabels(a: string, b: string): number {
  return a.localeCompare(b, "pl", { sensitivity: "base", numeric: true });
}
