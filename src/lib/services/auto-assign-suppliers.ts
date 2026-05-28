import { createAdminClient } from "@/lib/supabase/admin";
import { assessRequestCompleteness } from "@/lib/orders/request-completeness";
import type { IndividualOrder } from "@/types/database";

type LinkRow = {
  subiekt_tw_id: number;
  supplier_id: string;
  order_count: number;
  last_source: string | null;
};

function bestSupplierForTwId(links: LinkRow[]): { supplierId: string; orderCount: number; source: string | null } | null {
  if (!links.length) return null;
  // prefer większy order_count; przy remisie preferuj mocniejsze źródło
  const scoreSource = (s: string | null) =>
    s === "procurement_verification" ? 3 : s === "order_history" ? 2 : s === "zd_import" ? 1 : 0;
  const sorted = [...links].sort((a, b) => {
    const c = (b.order_count ?? 0) - (a.order_count ?? 0);
    if (c !== 0) return c;
    return scoreSource(b.last_source) - scoreSource(a.last_source);
  });
  const top = sorted[0]!;
  return { supplierId: String(top.supplier_id), orderCount: Number(top.order_count ?? 0), source: top.last_source ?? null };
}

/**
 * Uzupełnia supplier_id dla zamówień w Weryfikacji na podstawie product_supplier_links (po subiekt_tw_id).
 * Nie korzysta z Subiekta — tylko z naszej bazy mapowań.
 */
export async function autoAssignMissingSuppliersFromCatalog(options: {
  orderIds?: string[];
  salesPersonId?: string;
  limit?: number;
  minOrderCountForZdImport?: number;
}): Promise<{ checked: number; updated: number; promoted: number }> {
  const supabase = createAdminClient();
  const limit = options.limit != null ? Math.max(1, Math.min(200, options.limit)) : 80;
  const minZd = options.minOrderCountForZdImport ?? 3;

  let q = supabase
    .from("individual_orders")
    .select("id, supplier_id, sales_person_id, subiekt_tw_id, symbol, products, quantity, request_kind, status")
    .eq("status", "Weryfikacja")
    .is("supplier_id", null)
    .not("subiekt_tw_id", "is", null)
    .order("action_at", { ascending: false })
    .limit(limit);

  if (options.salesPersonId) q = q.eq("sales_person_id", options.salesPersonId);
  if (options.orderIds?.length) q = q.in("id", options.orderIds);

  const { data: rowsRaw, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (rowsRaw ?? []) as Array<Pick<
    IndividualOrder,
    "id" | "supplier_id" | "sales_person_id" | "subiekt_tw_id" | "symbol" | "products" | "quantity" | "request_kind" | "status"
  >>;

  const twIds = [...new Set(rows.map((r) => Number(r.subiekt_tw_id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!twIds.length) return { checked: rows.length, updated: 0, promoted: 0 };

  const { data: linksRaw, error: linkErr } = await supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id, supplier_id, order_count, last_source")
    .in("subiekt_tw_id", twIds);
  if (linkErr) throw new Error(linkErr.message);

  const links = (linksRaw ?? []) as LinkRow[];
  const byTwId = new Map<number, LinkRow[]>();
  for (const l of links) {
    const twId = Number(l.subiekt_tw_id);
    const list = byTwId.get(twId) ?? [];
    list.push(l);
    byTwId.set(twId, list);
  }

  let updated = 0;
  let promoted = 0;

  for (const row of rows) {
    const twId = Number(row.subiekt_tw_id);
    if (!Number.isFinite(twId) || twId <= 0) continue;
    const best = bestSupplierForTwId(byTwId.get(twId) ?? []);
    if (!best) continue;

    // Bezpieczeństwo: jeśli jedyne źródło to zd_import, wymagaj minimalnej liczby wystąpień.
    if (best.source === "zd_import" && best.orderCount < minZd) continue;

    const kind = (row.request_kind ?? "zamowienie") as IndividualOrder["request_kind"];
    const assessment = assessRequestCompleteness({
      supplierId: best.supplierId,
      symbol: row.symbol ?? undefined,
      product: row.products ?? undefined,
      quantity: row.quantity ?? undefined,
      requestKind: kind,
    });
    const nextStatus = assessment === "complete" ? "Nowe" : "Weryfikacja";

    const { data: upd, error: updErr } = await supabase
      .from("individual_orders")
      .update({ supplier_id: best.supplierId, status: nextStatus })
      .eq("id", row.id)
      .is("supplier_id", null)
      .eq("status", "Weryfikacja")
      .select("id, status")
      .maybeSingle();

    if (updErr) throw new Error(updErr.message);
    if (upd) {
      updated += 1;
      if ((upd as any).status === "Nowe") promoted += 1;
    }
  }

  return { checked: rows.length, updated, promoted };
}

