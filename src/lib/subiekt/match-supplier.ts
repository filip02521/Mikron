import { findSupplierBySubiektKhIdPreferCanonical } from "@/lib/subiekt/dedupe-suppliers-by-kh";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

export type AppSupplierRef = {
  id: string;
  name: string;
  subiektKhId?: number | null;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function kontrahentLabels(k: SubiektKontrahent): string[] {
  return [k.adr_NazwaPelna, k.adr_Nazwa, k.kh_Symbol]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => normalize(v));
}

/** Szukaj dostawcy po zapisanym kh_Id (najpewniejsze). */
export function findSupplierBySubiektKhId(
  khId: number,
  suppliers: AppSupplierRef[]
): AppSupplierRef | null {
  if (!Number.isFinite(khId)) return null;
  return findSupplierBySubiektKhIdPreferCanonical(khId, suppliers);
}

/** Dopasowanie kontrahenta Subiekt → dostawca (najpierw kh_Id, potem nazwa). */
export function matchSubiektKontrahentToSupplier(
  k: SubiektKontrahent,
  suppliers: AppSupplierRef[]
): string | null {
  if (k.kh_Id != null) {
    const byId = findSupplierBySubiektKhId(k.kh_Id, suppliers);
    if (byId) return byId.id;
  }

  const labels = kontrahentLabels(k);
  if (labels.length === 0) return null;

  for (const s of suppliers) {
    const sn = normalize(s.name);
    if (!sn) continue;
    for (const label of labels) {
      if (label === sn || sn.includes(label) || label.includes(sn)) {
        return s.id;
      }
    }
  }
  return null;
}

export function formatSubiektKontrahentLabel(k: SubiektKontrahent): string {
  const name = k.adr_NazwaPelna ?? k.adr_Nazwa ?? k.kh_Symbol ?? "Kontrahent";
  const sym = k.kh_Symbol && k.kh_Symbol !== name ? k.kh_Symbol : null;
  return sym ? `${sym} — ${name}` : name;
}

export function toAppSupplierRefs(
  suppliers: Array<{ id: string; name: string; subiekt_kh_id?: number | null }>
): AppSupplierRef[] {
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    subiektKhId: s.subiekt_kh_id ?? null,
  }));
}

/** Ocena dopasowania nazwy (0–100) — do skryptu powiązań i podpowiedzi. */
export function scoreSupplierKontrahentMatch(
  supplierName: string,
  k: SubiektKontrahent
): number {
  const sn = normalize(supplierName);
  if (!sn) return 0;

  let best = 0;
  for (const label of kontrahentLabels(k)) {
    if (label === sn) return 100;
    if (sn.includes(label) || label.includes(sn)) {
      const ratio = Math.min(label.length, sn.length) / Math.max(label.length, sn.length);
      best = Math.max(best, Math.round(70 + ratio * 25));
    }
  }

  const sym = k.kh_Symbol ? normalize(k.kh_Symbol) : "";
  if (sym && (sn.includes(sym) || sym.includes(sn))) {
    best = Math.max(best, 65);
  }

  return best;
}
