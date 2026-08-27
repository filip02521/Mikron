/**
 * Przeliczenie jednostek dokumentu ZD ↔ sztuki (opakowania).
 * Wydzielone, żeby uniknąć cyklu manual ↔ packaging.
 */

export type ZdPackagingDocumentUnitMode = "packages" | "pieces_multiple";

export function normalizePackagingDocumentUnitMode(
  value: unknown
): ZdPackagingDocumentUnitMode {
  return value === "pieces_multiple" ? "pieces_multiple" : "packages";
}

export function isPackagingPackagesMode(
  mode: unknown
): boolean {
  return normalizePackagingDocumentUnitMode(mode) === "packages";
}

export function normalizeUnitsPerPackage(
  value: number | null | undefined
): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/**
 * Wielokrotność liczby paczek (tryb packages).
 * NULL / 1 / NaN → wyłączone (0 w normalizacji = off).
 */
export function normalizeOrderMultiple(
  value: number | null | undefined
): number {
  if (value == null) return 0;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 2) return 0;
  return n;
}

/**
 * Otwarte ZD / qty z dokumentu → sztuki.
 * Mode A (packages): API trzyma paczki → × N.
 * Mode B (pieces_multiple): dokument już w sztukach → identity.
 */
export function zdDocumentUnitsToPieces(
  docUnits: number,
  unitsPerPackage: number | null | undefined,
  documentUnitMode: ZdPackagingDocumentUnitMode | null | undefined = "packages"
): number {
  const units = Math.max(0, Number(docUnits) || 0);
  if (!isPackagingPackagesMode(documentUnitMode)) {
    return units;
  }
  const pack = normalizeUnitsPerPackage(unitsPerPackage);
  return pack > 1 ? units * pack : units;
}
