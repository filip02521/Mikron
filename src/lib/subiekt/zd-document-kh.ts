import type { SubiektDocument } from "@/lib/subiekt/types";

function normalizeNumeric(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** Identyfikatory kontrahentów z dokumentu ZD (płatnik, odbiorca, dostawca itd.). */
export function extractDocKhIds(doc: SubiektDocument): number[] {
  const ids: number[] = [];
  ids.push(
    ...[
      normalizeNumeric((doc as Record<string, unknown>).dok_OdbiorcaId),
      normalizeNumeric((doc as Record<string, unknown>).dok_PlatnikId),
      normalizeNumeric((doc as Record<string, unknown>).kh_Id),
      normalizeNumeric((doc as Record<string, unknown>).dok_KontrahentId),
      normalizeNumeric((doc as Record<string, unknown>).dok_KhId),
      normalizeNumeric((doc as Record<string, unknown>).dok_DostawcaId),
    ].filter((n): n is number => n != null)
  );
  for (const k of [
    (doc as Record<string, unknown>).kh__Kontrahent_Platnik,
    (doc as Record<string, unknown>).kh__Kontrahent_Odbiorca,
  ]) {
    const row = k as { kh_Id?: unknown } | null | undefined;
    const n = normalizeNumeric(row?.kh_Id);
    if (n != null) ids.push(n);
  }
  return [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
}
