import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { recordSupplierResolveLog } from "@/lib/data/supplier-resolve-metrics";
import {
  getCachedSupplierForSubiektProduct,
  upsertCachedSupplierForSubiektProduct,
} from "@/lib/data/product-supplier-cache";
import { getSubiektProduct } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { dedupeAppSuppliersByKhId } from "@/lib/subiekt/dedupe-suppliers-by-kh";
import {
  assessRequestCompleteness,
  hasValidOrderQuantity,
} from "@/lib/orders/request-completeness";
import { lookupSupplierForSubiektProduct } from "@/lib/subiekt/product-supplier";
import type { SubiektProduct } from "@/lib/subiekt/types";
import type { IndividualRequestKind } from "@/types/database";

export type ResolveOrderSupplierResult =
  | "promoted"
  | "failed"
  | "skipped"
  | "not_found";

async function loadOrder(orderId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, status, supplier_id, supplier_resolve_pending, subiekt_tw_id, symbol, products, quantity, request_kind"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function productFromOrder(row: {
  subiekt_tw_id: number | null;
  symbol: string;
  products: string;
}): SubiektProduct | null {
  const twId = row.subiekt_tw_id;
  if (twId == null || twId <= 0) return null;
  return {
    tw_Id: twId,
    tw_Symbol: row.symbol !== "-" ? row.symbol : "",
    tw_Nazwa: row.products,
  };
}

function logResult(
  orderId: string,
  result: ResolveOrderSupplierResult | "offline",
  started: number
) {
  return recordSupplierResolveLog(orderId, result, Date.now() - started);
}

/** Jedna prośba — dopasowanie dostawcy z ZD; przy sukcesie status → Nowe. */
export async function resolveOrderSupplierBackground(
  orderId: string
): Promise<ResolveOrderSupplierResult> {
  const started = Date.now();

  const row = await loadOrder(orderId);
  if (!row) {
    await logResult(orderId, "skipped", started);
    return "skipped";
  }
  if (!row.supplier_resolve_pending) {
    await logResult(orderId, "skipped", started);
    return "skipped";
  }
  if (row.status !== "Weryfikacja") {
    await clearPending(orderId);
    await logResult(orderId, "skipped", started);
    return "skipped";
  }
  if (row.supplier_id) {
    await clearPending(orderId);
    await logResult(orderId, "skipped", started);
    return "skipped";
  }

  const product = productFromOrder(row);
  if (!product) {
    await clearPending(orderId);
    await logResult(orderId, "skipped", started);
    return "skipped";
  }

  if (!(await isSubiektReachable())) {
    await logResult(orderId, "offline", started);
    return "failed";
  }

  // 0) Najtańsze: cache z poprzednich dopasowań (jeśli jest świeże i dostawca dalej istnieje).
  const cached = await getCachedSupplierForSubiektProduct(product.tw_Id);
  if (cached?.supplierId) {
    const kind = (row.request_kind ?? "zamowienie") as IndividualRequestKind;
    const assessment = assessRequestCompleteness({
      supplierId: cached.supplierId,
      symbol: row.symbol,
      product: row.products,
      quantity: row.quantity,
      requestKind: kind,
    });
    if (assessment === "complete" && (kind !== "zamowienie" || hasValidOrderQuantity(row.quantity, kind))) {
      const supabase = createAdminClient();
      const { data: updated, error } = await supabase
        .from("individual_orders")
        .update({
          supplier_id: cached.supplierId,
          status: "Nowe",
          supplier_resolve_pending: false,
        })
        .eq("id", orderId)
        .eq("status", "Weryfikacja")
        .select("id")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (updated) {
        await logResult(orderId, "promoted", started);
        return "promoted";
      }
    }
  }

  let fullProduct = product;
  try {
    fullProduct = await getSubiektProduct(product.tw_Id);
  } catch {
    /* użyj danych z prośby */
  }

  const appSuppliers = dedupeAppSuppliersByKhId(await getAppSupplierRefsCached());
  const lookup = await lookupSupplierForSubiektProduct(fullProduct, appSuppliers);

  if (lookup.status !== "mapped") {
    // 3) Ostatnia deska ratunku: nasza historia individual_orders.
    // Tańsze niż dalsze grzebanie w ZD i często trafne, gdy towar był kupowany dawno temu.
    const historySupplierId = await findSupplierFromIndividualHistory(fullProduct.tw_Id);
    if (historySupplierId) {
      await upsertCachedSupplierForSubiektProduct({
        subiektTwId: fullProduct.tw_Id,
        supplierId: historySupplierId,
        source: "history",
      });

      const kind = (row.request_kind ?? "zamowienie") as IndividualRequestKind;
      const assessment = assessRequestCompleteness({
        supplierId: historySupplierId,
        symbol: row.symbol,
        product: row.products,
        quantity: row.quantity,
        requestKind: kind,
      });
      if (assessment === "complete" && (kind !== "zamowienie" || hasValidOrderQuantity(row.quantity, kind))) {
        const supabase = createAdminClient();
        const { data: updated, error } = await supabase
          .from("individual_orders")
          .update({
            supplier_id: historySupplierId,
            status: "Nowe",
            supplier_resolve_pending: false,
          })
          .eq("id", orderId)
          .eq("status", "Weryfikacja")
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (updated) {
          await logResult(orderId, "promoted", started);
          return "promoted";
        }
      }
    }

    await clearPending(orderId);
    const outcome = lookup.status === "not_found" ? "not_found" : "failed";
    await logResult(orderId, outcome, started);
    return outcome;
  }

  await upsertCachedSupplierForSubiektProduct({
    subiektTwId: fullProduct.tw_Id,
    supplierId: lookup.supplierId,
    source: "zd",
  });

  const kind = (row.request_kind ?? "zamowienie") as IndividualRequestKind;
  const assessment = assessRequestCompleteness({
    supplierId: lookup.supplierId,
    symbol: row.symbol,
    product: row.products,
    quantity: row.quantity,
    requestKind: kind,
  });

  if (assessment !== "complete") {
    await clearPending(orderId);
    await logResult(orderId, "failed", started);
    return "failed";
  }

  if (kind === "zamowienie" && !hasValidOrderQuantity(row.quantity, kind)) {
    await clearPending(orderId);
    await logResult(orderId, "failed", started);
    return "failed";
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("individual_orders")
    .update({
      supplier_id: lookup.supplierId,
      status: "Nowe",
      supplier_resolve_pending: false,
    })
    .eq("id", orderId)
    .eq("status", "Weryfikacja")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) {
    await clearPending(orderId);
    await logResult(orderId, "skipped", started);
    return "skipped";
  }

  await logResult(orderId, "promoted", started);
  return "promoted";
}

async function findSupplierFromIndividualHistory(
  subiektTwId: number
): Promise<string | null> {
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("supplier_id, action_at")
    .eq("subiekt_tw_id", Math.trunc(subiektTwId))
    .not("supplier_id", "is", null)
    .order("action_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row?.supplier_id ?? null;
}

async function clearPending(orderId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("individual_orders")
    .update({ supplier_resolve_pending: false })
    .eq("id", orderId);
}

export async function resolveOrdersSupplierBackground(
  orderIds: string[]
): Promise<{ promoted: number; failed: number; skipped: number }> {
  const counts = { promoted: 0, failed: 0, skipped: 0 };
  for (const id of orderIds) {
    try {
      const r = await resolveOrderSupplierBackground(id);
      if (r === "promoted") counts.promoted++;
      else if (r === "failed" || r === "not_found") counts.failed++;
      else counts.skipped++;
    } catch {
      counts.failed++;
    }
  }
  return counts;
}

/** Kolejka — prośby z zawieszonym dopasowaniem (cron / retry). */
export async function fetchPendingSupplierResolveOrderIds(
  limit = 20
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id")
    .eq("supplier_resolve_pending", true)
    .eq("status", "Weryfikacja")
    .is("supplier_id", null)
    .order("action_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}
