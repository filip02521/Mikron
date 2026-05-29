import { createAdminClient } from "@/lib/supabase/admin";
import { collectKhIdsForSupplierRef } from "@/lib/data/supplier-subiekt-kh";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import { scoreCompanyNameMatch } from "@/lib/subiekt/company-name-match";
import type { ZdUnmappedKhRow } from "@/lib/subiekt/zd-unmapped-kh";

export type KhSupplierSuggestionAction = "add_alias" | "reindex";

export type KhSupplierSuggestion = {
  supplierId: string;
  supplierName: string;
  score: number;
  reason: string;
  action: KhSupplierSuggestionAction;
};

export type ZdUnmappedKhRowWithSuggestion = ZdUnmappedKhRow & {
  suggestion: KhSupplierSuggestion | null;
};

const MIN_SCORE_ALIAS = 58;

async function loadSuppliersForMatching(): Promise<AppSupplierRef[]> {
  const supabase = createAdminClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .order("name");
  if (error) throw new Error(error.message);

  const { data: aliases, error: aliasErr } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("supplier_id, subiekt_kh_id");
  if (aliasErr) throw new Error(aliasErr.message);

  const aliasesBySupplier = new Map<string, number[]>();
  for (const row of aliases ?? []) {
    const sid = String((row as { supplier_id: string }).supplier_id);
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!Number.isFinite(kh) || kh <= 0) continue;
    const list = aliasesBySupplier.get(sid) ?? [];
    list.push(kh);
    aliasesBySupplier.set(sid, list);
  }

  return (suppliers ?? []).map((s) => {
    const id = String((s as { id: string }).id);
    const primary =
      (s as { subiekt_kh_id: number | null }).subiekt_kh_id != null
        ? Math.trunc(Number((s as { subiekt_kh_id: number }).subiekt_kh_id))
        : null;
    const rawAliases = aliasesBySupplier.get(id) ?? [];
    const additionalSubiektKhIds = rawAliases.filter((kh) => kh !== primary);
    return {
      id,
      name: String((s as { name: string }).name),
      subiektKhId: primary,
      additionalSubiektKhIds:
        additionalSubiektKhIds.length > 0 ? additionalSubiektKhIds : undefined,
    };
  });
}

function supplierOwnsKh(supplier: AppSupplierRef, khId: number): boolean {
  return collectKhIdsForSupplierRef(supplier).includes(Math.trunc(khId));
}

export function suggestSupplierForUnmappedRow(
  row: ZdUnmappedKhRow,
  suppliers: AppSupplierRef[],
  ownerSupplierIdByKh: Map<number, string>
): KhSupplierSuggestion | null {
  if (row.reason === "supplier_exists_reindex" && row.supplierHint) {
    const ownerId = ownerSupplierIdByKh.get(row.subiektKhId);
    if (!ownerId) return null;
    return {
      supplierId: ownerId,
      supplierName: row.supplierHint,
      score: 100,
      reason: "Ten kh_Id jest już w kartotece — wystarczy ponowne indeksowanie ZD",
      action: "reindex",
    };
  }

  const label = row.kontrahentLabel?.trim();
  if (!label || row.reason !== "no_supplier_kh") return null;

  let best: KhSupplierSuggestion | null = null;

  for (const supplier of suppliers) {
    if (supplierOwnsKh(supplier, row.subiektKhId)) continue;

    const { score, reason } = scoreCompanyNameMatch(label, supplier.name);
    if (score < MIN_SCORE_ALIAS) continue;
    if (!best || score > best.score) {
      best = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        score,
        reason,
        action: "add_alias",
      };
    }
  }

  return best;
}

export async function attachKontrahentSupplierSuggestions(
  rows: ZdUnmappedKhRow[]
): Promise<ZdUnmappedKhRowWithSuggestion[]> {
  if (rows.length === 0) return [];

  const suppliers = await loadSuppliersForMatching();
  const { loadSupplierIdByKhMap } = await import("@/lib/data/supplier-subiekt-kh");
  const ownerSupplierIdByKh = await loadSupplierIdByKhMap();

  return rows.map((row) => ({
    ...row,
    suggestion: suggestSupplierForUnmappedRow(row, suppliers, ownerSupplierIdByKh),
  }));
}
