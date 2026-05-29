import { collectKhIdsForSupplierRef } from "@/lib/data/supplier-subiekt-kh";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

/**
 * Jedna karta na kh_Id do zapytań ZD — mniej duplikatów (np. MOTYL-Pro ×4).
 * Bez kh_Id — wszystkie karty zostają.
 */
export function dedupeAppSuppliersByKhId(suppliers: AppSupplierRef[]): AppSupplierRef[] {
  const withoutKh: AppSupplierRef[] = [];
  const byKh = new Map<number, AppSupplierRef>();

  for (const s of suppliers) {
    const khList = collectKhIdsForSupplierRef(s);
    if (khList.length === 0) {
      withoutKh.push(s);
      continue;
    }
    for (const kh of khList) {
      const existing = byKh.get(kh);
      if (!existing) {
        byKh.set(kh, s);
        continue;
      }
      if (s.name.length < existing.name.length) {
        byKh.set(kh, s);
      }
    }
  }

  const withKh = [...new Map([...byKh.values()].map((s) => [s.id, s])).values()];
  return [...withKh, ...withoutKh];
}

/** Preferowana karta dostawcy przy znanym kh_Id (krótsza nazwa = zwykle główna karta). */
export function findSupplierBySubiektKhIdPreferCanonical(
  khId: number,
  suppliers: AppSupplierRef[]
): AppSupplierRef | null {
  const kh = Math.trunc(khId);
  const matches = suppliers.filter((s) => collectKhIdsForSupplierRef(s).includes(kh));
  if (!matches.length) return null;
  return matches.sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}
