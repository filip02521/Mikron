import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

/**
 * Jedna karta na kh_Id do zapytań ZD — mniej duplikatów (np. MOTYL-Pro ×4).
 * Bez kh_Id — wszystkie karty zostają.
 */
export function dedupeAppSuppliersByKhId(suppliers: AppSupplierRef[]): AppSupplierRef[] {
  const withoutKh: AppSupplierRef[] = [];
  const byKh = new Map<number, AppSupplierRef>();

  for (const s of suppliers) {
    const kh = s.subiektKhId;
    if (kh == null || !Number.isFinite(kh)) {
      withoutKh.push(s);
      continue;
    }
    const existing = byKh.get(kh);
    if (!existing) {
      byKh.set(kh, s);
      continue;
    }
    if (s.name.length < existing.name.length) {
      byKh.set(kh, s);
    }
  }

  return [...byKh.values(), ...withoutKh];
}

/** Preferowana karta dostawcy przy znanym kh_Id (krótsza nazwa = zwykle główna karta). */
export function findSupplierBySubiektKhIdPreferCanonical(
  khId: number,
  suppliers: AppSupplierRef[]
): AppSupplierRef | null {
  const matches = suppliers.filter((s) => s.subiektKhId != null && s.subiektKhId === khId);
  if (!matches.length) return null;
  return matches.sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}
