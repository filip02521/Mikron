"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clampOptionalText } from "@/lib/security/text-limits";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { searchSubiektProducts } from "@/lib/subiekt/api";
import { indexOrderLineToProductCatalog } from "@/lib/data/product-catalog";

const MAX_NOTE_LEN = 500;

export async function actionUpdateSubiektProductNote(subiektTwId: number, note: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = clampOptionalText(note, MAX_NOTE_LEN) ?? "";
  const { error } = await supabase
    .from("subiekt_products")
    .update({ note: trimmed, updated_at: new Date().toISOString() })
    .eq("subiekt_tw_id", Math.trunc(subiektTwId));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/produkty");
  return { success: true as const };
}

export async function actionRebuildProductCatalogFromOrders(options?: { limit?: number }) {
  await requireAdmin();
  const supabase = createAdminClient();

  const limit = options?.limit != null ? Math.max(1, Math.min(5000, options.limit)) : 5000;

  const { data: ordersRaw, error } = await supabase
    .from("individual_orders")
    .select("id, supplier_id, subiekt_tw_id, symbol, products, mikran_code, action_at")
    .not("subiekt_tw_id", "is", null)
    .order("action_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const orders = (ordersRaw ?? []).filter((o) => typeof o.subiekt_tw_id === "number") as Array<{
    id: string;
    supplier_id: string | null;
    subiekt_tw_id: number;
    symbol: string;
    products: string;
    mikran_code: string | null;
    action_at: string;
  }>;

  const twIds = [...new Set(orders.map((o) => Math.trunc(o.subiekt_tw_id)).filter((n) => n > 0))];
  if (!twIds.length) return { success: true as const, products: 0, links: 0, scanned: 0 };

  const { data: existingProductsRaw } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id, note")
    .in("subiekt_tw_id", twIds);
  const existingNotes = new Map<number, string>(
    (existingProductsRaw ?? []).map((p) => [Number(p.subiekt_tw_id), String(p.note ?? "")])
  );

  const productLatest = new Map<
    number,
    { symbol: string | null; name: string | null; plu: string | null; lastSeenAt: string }
  >();

  for (const o of orders) {
    const twId = Math.trunc(o.subiekt_tw_id);
    if (twId <= 0) continue;
    if (productLatest.has(twId)) continue; // orders są posortowane malejąco, pierwszy wygrywa
    productLatest.set(twId, {
      symbol: (o.symbol ?? "").trim() || null,
      name: (o.products ?? "").trim() || null,
      plu: (o.mikran_code ?? "").trim() || null,
      lastSeenAt: o.action_at ?? new Date().toISOString(),
    });
  }

  const productsUpserts = twIds.map((twId) => {
    const latest = productLatest.get(twId);
    return {
      subiekt_tw_id: twId,
      symbol: latest?.symbol ?? null,
      name: latest?.name ?? null,
      plu: latest?.plu ?? null,
      note: existingNotes.get(twId) ?? "",
      updated_at: new Date().toISOString(),
      last_seen_at: latest?.lastSeenAt ?? new Date().toISOString(),
    };
  });

  const { error: upsertProductsError } = await supabase
    .from("subiekt_products")
    .upsert(productsUpserts, { onConflict: "subiekt_tw_id" });
  if (upsertProductsError) throw new Error(upsertProductsError.message);

  // Odbudowa linków: czyścimy tylko część wynikającą z historii zamówień,
  // ale zostawiamy wpisy z innych źródeł (np. zd_import) i notatki.
  // Najprościej: update/insert linków policzonych z historii, nie usuwamy innych.
  const linkKey = (twId: number, supplierId: string) => `${twId}|${supplierId}`;

  const linksAgg = new Map<
    string,
    { twId: number; supplierId: string; count: number; lastAt: string; lastOrderId: string }
  >();

  for (const o of orders) {
    const twId = Math.trunc(o.subiekt_tw_id);
    const supplierId = o.supplier_id;
    if (!supplierId || twId <= 0) continue;
    const key = linkKey(twId, supplierId);
    const prev = linksAgg.get(key);
    if (!prev) {
      linksAgg.set(key, {
        twId,
        supplierId,
        count: 1,
        lastAt: o.action_at ?? new Date().toISOString(),
        lastOrderId: o.id,
      });
    } else {
      prev.count += 1;
      // orders są posortowane malejąco, więc prev.lastAt już jest najnowsze
    }
  }

  const linkRows = [...linksAgg.values()];
  if (linkRows.length) {
    const { data: existingLinksRaw } = await supabase
      .from("product_supplier_links")
      .select("subiekt_tw_id, supplier_id, note, last_source")
      .in(
        "subiekt_tw_id",
        [...new Set(linkRows.map((l) => l.twId))]
      );

    const existingLinkNotes = new Map<string, string>();
    const existingLinkSource = new Map<string, string>();
    for (const row of existingLinksRaw ?? []) {
      const k = linkKey(Number(row.subiekt_tw_id), String(row.supplier_id));
      existingLinkNotes.set(k, String(row.note ?? ""));
      existingLinkSource.set(k, String(row.last_source ?? ""));
    }

    const upserts = linkRows.map((l) => {
      const k = linkKey(l.twId, l.supplierId);
      const keepSource = existingLinkSource.get(k);
      return {
        subiekt_tw_id: l.twId,
        supplier_id: l.supplierId,
        order_count: l.count,
        last_action_at: l.lastAt,
        last_order_id: l.lastOrderId,
        last_source: keepSource && keepSource !== "order_history" ? keepSource : "order_history",
        note: existingLinkNotes.get(k) ?? "",
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertLinksError } = await supabase
      .from("product_supplier_links")
      .upsert(upserts, { onConflict: "subiekt_tw_id,supplier_id" });
    if (upsertLinksError) throw new Error(upsertLinksError.message);
  }

  revalidatePath("/admin/produkty");
  return {
    success: true as const,
    scanned: orders.length,
    products: productsUpserts.length,
    links: linkRows.length,
  };
}

function normalizeSymbol(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Backfill `individual_orders.subiekt_tw_id` na podstawie symbolu (Subiekt tw_Symbol),
 * a następnie indeksuje do własnej bazy produktów razem z dostawcą z historii.
 *
 * Wymaga dostępu do Subiekt API (LAN).
 */
export async function actionBackfillOrdersSubiektTwIdFromSymbol(options?: {
  limit?: number;
}): Promise<{
  success: true;
  scanned: number;
  updated: number;
  indexed: number;
  skippedOffline: boolean;
}> {
  await requireAdmin();
  const supabase = createAdminClient();

  const limit = options?.limit != null ? Math.max(1, Math.min(400, options.limit)) : 200;

  if (!(await isSubiektReachable())) {
    return { success: true, scanned: 0, updated: 0, indexed: 0, skippedOffline: true };
  }

  const { data: ordersRaw, error } = await supabase
    .from("individual_orders")
    .select("id, supplier_id, subiekt_tw_id, symbol, products, mikran_code, action_at")
    .is("subiekt_tw_id", null)
    .not("symbol", "eq", "-")
    .not("supplier_id", "is", null)
    .order("action_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const orders = (ordersRaw ?? []) as Array<{
    id: string;
    supplier_id: string;
    subiekt_tw_id: number | null;
    symbol: string;
    products: string;
    mikran_code: string | null;
    action_at: string;
  }>;

  let scanned = 0;
  let updated = 0;
  let indexed = 0;

  for (const o of orders) {
    scanned += 1;
    const sym = normalizeSymbol(o.symbol);
    if (!sym) continue;

    try {
      const res = await searchSubiektProducts({ symbol: o.symbol.trim(), pageSize: 12, page: 1 });
      const exact = res.data.find((p) => normalizeSymbol(p.tw_Symbol) === sym) ?? null;
      const picked = exact ?? res.data[0] ?? null;
      const twId = picked?.tw_Id != null ? Number(picked.tw_Id) : null;
      if (!twId || !Number.isFinite(twId) || twId <= 0) continue;

      const { error: updErr } = await supabase
        .from("individual_orders")
        .update({ subiekt_tw_id: Math.trunc(twId) })
        .eq("id", o.id)
        .is("subiekt_tw_id", null);
      if (updErr) throw new Error(updErr.message);
      updated += 1;

      await indexOrderLineToProductCatalog({
        orderId: o.id,
        subiektTwId: Math.trunc(twId),
        symbol: o.symbol ?? null,
        productName: o.products ?? null,
        mikranCode: o.mikran_code ?? null,
        supplierId: o.supplier_id ?? null,
        actionAt: o.action_at ?? null,
        source: "order_history",
      });
      indexed += 1;
    } catch {
      // best-effort: pomijamy błędy pojedynczych rekordów
    }
  }

  revalidatePath("/admin/produkty");
  return { success: true, scanned, updated, indexed, skippedOffline: false };
}

