import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = 1000;

export type ZdUnmappedKhReason =
  | "no_supplier_kh"
  | "supplier_exists_reindex";

export type ZdUnmappedKhRow = {
  subiektKhId: number;
  /** Nazwa kontrahenta z Subiekta (do wyszukiwania w programie). */
  kontrahentLabel: string | null;
  zdCount: number;
  sampleDocNumbers: string[];
  lastDocDate: string | null;
  reason: ZdUnmappedKhReason;
  /** Gdy reason = supplier_exists_reindex — dostawca z tym kh_Id w kartotece. */
  supplierHint: string | null;
};

export type { KhSupplierSuggestion, ZdUnmappedKhRowWithSuggestion } from "@/lib/subiekt/kontrahent-supplier-suggestions";

export type ZdUnmappedKhReport = {
  rows: import("@/lib/subiekt/kontrahent-supplier-suggestions").ZdUnmappedKhRowWithSuggestion[];
  totalUnmappedZd: number;
  indexedAt: string | null;
};

type IndexRow = {
  subiekt_kh_id: number;
  dok_nr_pelny: string | null;
  dok_data_wyst: string | null;
  subiekt_kh_label?: string | null;
};

export function aggregateZdUnmappedByKh(
  indexRows: IndexRow[],
  supplierByKh: Map<number, string>
): ZdUnmappedKhRow[] {
  const byKh = new Map<
    number,
    { zdCount: number; samples: string[]; lastDate: string | null; label: string | null }
  >();

  for (const row of indexRows) {
    const kh = Math.trunc(Number(row.subiekt_kh_id));
    if (!Number.isFinite(kh) || kh <= 0) continue;
    const cur = byKh.get(kh) ?? { zdCount: 0, samples: [], lastDate: null, label: null };
    cur.zdCount += 1;
    const rowLabel = row.subiekt_kh_label?.trim();
    if (rowLabel && (!cur.label || rowLabel.length > cur.label.length)) {
      cur.label = rowLabel;
    }
    const nr = row.dok_nr_pelny?.trim();
    if (nr && cur.samples.length < 5 && !cur.samples.includes(nr)) {
      cur.samples.push(nr);
    }
    const d = row.dok_data_wyst?.trim() || null;
    if (d && (!cur.lastDate || d > cur.lastDate)) cur.lastDate = d;
    byKh.set(kh, cur);
  }

  const rows: ZdUnmappedKhRow[] = [];
  for (const [subiektKhId, agg] of byKh.entries()) {
    const supplierName = supplierByKh.get(subiektKhId) ?? null;
    rows.push({
      subiektKhId,
      kontrahentLabel: agg.label,
      zdCount: agg.zdCount,
      sampleDocNumbers: agg.samples,
      lastDocDate: agg.lastDate,
      reason: supplierName ? "supplier_exists_reindex" : "no_supplier_kh",
      supplierHint: supplierName,
    });
  }

  rows.sort((a, b) => b.zdCount - a.zdCount || a.subiektKhId - b.subiektKhId);
  return rows;
}

/** Kontrahenci (kh_Id) z ZD w indeksie, bez przypisanego dostawcy w aplikacji. */
export async function fetchZdUnmappedKhReport(): Promise<ZdUnmappedKhReport> {
  const supabase = createAdminClient();

  const { loadSupplierNameByKhMap } = await import("@/lib/data/supplier-subiekt-kh");
  const supplierByKh = await loadSupplierNameByKhMap();

  const indexRows: IndexRow[] = [];
  let offset = 0;
  let latestProcessed: string | null = null;

  while (true) {
    const { data, error } = await supabase
      .from("subiekt_zd_index")
      .select("subiekt_kh_id, subiekt_kh_label, dok_nr_pelny, dok_data_wyst, processed_at")
      .is("supplier_id", null)
      .eq("verified", true)
      .not("subiekt_kh_id", "is", null)
      .order("subiekt_kh_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const kh = Number((row as { subiekt_kh_id: number }).subiekt_kh_id);
      if (!Number.isFinite(kh)) continue;
      indexRows.push({
        subiekt_kh_id: Math.trunc(kh),
        subiekt_kh_label: (row as { subiekt_kh_label?: string | null }).subiekt_kh_label ?? null,
        dok_nr_pelny: (row as { dok_nr_pelny: string | null }).dok_nr_pelny,
        dok_data_wyst: (row as { dok_data_wyst: string | null }).dok_data_wyst,
      });
      const at = (row as { processed_at?: string }).processed_at;
      if (at && (!latestProcessed || at > latestProcessed)) latestProcessed = at;
    }
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  const rows = aggregateZdUnmappedByKh(indexRows, supplierByKh);
  const { resolveSubiektKontrahentLabels } = await import("@/lib/subiekt/resolve-kontrahent-labels");
  const prefilled = new Map<number, string>();
  for (const r of rows) {
    if (r.kontrahentLabel?.trim()) prefilled.set(r.subiektKhId, r.kontrahentLabel.trim());
  }
  const labels = await resolveSubiektKontrahentLabels(rows.map((r) => r.subiektKhId), {
    prefilled,
  });

  const withLabels = rows.map((r) => ({
    ...r,
    kontrahentLabel: labels.get(r.subiektKhId) ?? r.kontrahentLabel ?? null,
  }));

  const { attachKontrahentSupplierSuggestions } = await import(
    "@/lib/subiekt/kontrahent-supplier-suggestions"
  );
  const withSuggestions = await attachKontrahentSupplierSuggestions(withLabels);

  return {
    rows: withSuggestions,
    totalUnmappedZd: indexRows.length,
    indexedAt: latestProcessed,
  };
}
