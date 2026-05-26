import type { SubiektKontrahent } from "@/lib/subiekt/types";

export type AppSupplierRef = { id: string; name: string };

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

/** Dopasowanie kontrahenta Subiekt → dostawca w aplikacji (po nazwie / symbolu). */
export function matchSubiektKontrahentToSupplier(
  k: SubiektKontrahent,
  suppliers: AppSupplierRef[]
): string | null {
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
