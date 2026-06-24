import type { SubiektDocument } from "@/lib/subiekt/types";

/** Wiersz listy GET /documents/zd — nagłówek bez linii (dok_Pozycja tylko w GET /documents/zd/:id). */
export type SubiektZdListItem = Pick<
  SubiektDocument,
  | "dok_Id"
  | "dok_Status"
  | "dok_DataWyst"
  | "dok_TerminRealizacji"
  | "dok_OdbiorcaId"
  | "dok_PlatnikId"
> & {
  kh__Kontrahent_Odbiorca?: { kh_Id?: unknown } | null;
  kh__Kontrahent_Platnik?: { kh_Id?: unknown } | null;
  [key: string]: unknown;
};

function normalizeNumeric(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function extractKhIdsFromRecord(row: Record<string, unknown>): number[] {
  const ids: number[] = [];
  ids.push(
    ...[
      normalizeNumeric(row.dok_OdbiorcaId),
      normalizeNumeric(row.dok_PlatnikId),
      normalizeNumeric(row.kh_Id),
      normalizeNumeric(row.dok_KontrahentId),
      normalizeNumeric(row.dok_KhId),
      normalizeNumeric(row.dok_DostawcaId),
    ].filter((n): n is number => n != null)
  );
  for (const k of [row.kh__Kontrahent_Platnik, row.kh__Kontrahent_Odbiorca]) {
    const kontrahent = k as { kh_Id?: unknown } | null | undefined;
    const n = normalizeNumeric(kontrahent?.kh_Id);
    if (n != null) ids.push(n);
  }
  return [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
}

/** Identyfikatory kontrahentów z dokumentu ZD (płatnik, odbiorca, dostawca itd.). */
export function extractDocKhIds(doc: SubiektDocument): number[] {
  return extractKhIdsFromRecord(doc as Record<string, unknown>);
}

/** Identyfikatory kontrahentów z wiersza listy ZD (bez ładowania pełnego dokumentu). */
export function extractListItemKhIds(item: SubiektZdListItem): number[] {
  return extractKhIdsFromRecord(item as Record<string, unknown>);
}

/**
 * Czy wiersz listy ZD należy do dostawcy (kh_Id główny lub alias).
 * API `khId` w query NIE filtruje listy — ten filtr jest po stronie aplikacji.
 */
export function zdListItemMatchesSupplierKhIds(
  item: SubiektZdListItem,
  khIds: readonly number[]
): boolean {
  const allowed = new Set(
    khIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (!allowed.size) return false;
  return extractListItemKhIds(item).some((id) => allowed.has(id));
}
