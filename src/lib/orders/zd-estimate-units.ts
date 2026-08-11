/**
 * Przeliczenie jednostek dokumentu ZD ↔ sztuki (opakowania).
 * Wydzielone, żeby uniknąć cyklu manual ↔ packaging.
 */

export function normalizeUnitsPerPackage(
  value: number | null | undefined
): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/**
 * Otwarte ZD / qty z dokumentu → sztuki.
 * Przy opakowaniu API trzyma jednostki ZD (paczki).
 */
export function zdDocumentUnitsToPieces(
  docUnits: number,
  unitsPerPackage: number | null | undefined
): number {
  const units = Math.max(0, Number(docUnits) || 0);
  const pack = normalizeUnitsPerPackage(unitsPerPackage);
  return pack > 1 ? units * pack : units;
}
