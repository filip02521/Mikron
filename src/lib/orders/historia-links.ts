/**
 * Deep-linki do /historia z filtrem po dostawcy (panel boczny, skróty).
 * `tab` = individual | normal
 * `supplier` = uuid dostawcy (precyzyjny filtr)
 * `q` = fraza w polu wyszukiwania (zwykle nazwa — podgląd dla użytkownika)
 */

export type HistoriaBrowseTab = "individual" | "normal";

export function parseHistoriaBrowseTab(raw: string | null | undefined): HistoriaBrowseTab | null {
  if (raw === "individual" || raw === "normal") return raw;
  return null;
}

export function parseHistoriaSupplierId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return null;
  }
  return id;
}

export function supplierHistoriaHref(
  kind: HistoriaBrowseTab,
  supplier: { id: string; name: string }
): string {
  const params = new URLSearchParams();
  params.set("tab", kind);
  const id = supplier.id.trim();
  if (id) params.set("supplier", id);
  const q = supplier.name.trim();
  if (q) params.set("q", q);
  return `/historia?${params.toString()}`;
}
