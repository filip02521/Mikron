/** Zbieranie kh_Id dostawcy — bezpieczne dla klienta (bez Supabase / match-supplier I/O). */

import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

/** Wszystkie kh_Id przypisane do dostawcy (główny + dodatkowe). */
export function collectKhIdsForSupplierRef(s: AppSupplierRef): number[] {
  const ids = new Set<number>();
  const primary = s.subiektKhId;
  if (primary != null && Number.isFinite(primary) && primary > 0) {
    ids.add(Math.trunc(primary));
  }
  for (const id of s.additionalSubiektKhIds ?? []) {
    if (Number.isFinite(id) && id > 0) ids.add(Math.trunc(id));
  }
  return [...ids];
}

/** Mapa supplier_id → kh_Id (główny + aliasy) do UI sync ZD. */
export function buildSupplierKhIdsBySupplierId(
  refs: readonly AppSupplierRef[]
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const ref of refs) {
    const ids = collectKhIdsForSupplierRef(ref);
    if (ids.length) map[ref.id] = ids;
  }
  return map;
}
