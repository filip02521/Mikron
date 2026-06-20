"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAdminForMutation } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clampOptionalText } from "@/lib/security/text-limits";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { searchSubiektProducts } from "@/lib/subiekt/api";
import {
  assignProductSupplierLinkAdmin,
  indexOrderLineToProductCatalog,
} from "@/lib/data/product-catalog";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { autoAssignMissingSuppliersFromCatalog } from "@/lib/services/auto-assign-suppliers";
import {
  countProductCatalogCoverage,
  fetchProductCatalogPage,
  fetchProductCatalogRowsByTwIds,
  fetchProductsWithoutSupplierPage,
  searchProductCatalogPage,
  searchProductsWithoutSupplierPage,
  type ProductCatalogCoverageStats,
  type ProductCatalogPage,
  type ProductCatalogRow,
} from "@/lib/data/product-catalog-queries";
import {
  clearZdImportSupplierJobState,
  continueZdImportForSupplier,
  readZdImportSupplierJobState,
  startZdImportForSupplier,
  stopZdImportForSupplier,
  tickZdImportForSupplier,
  type ZdImportSupplierJobState,
} from "@/lib/subiekt/zd-import-supplier-job";
import {
  readZdIndexJobState,
  startZdIndexJob,
  stopZdIndexJob,
  continueZdIndexJob,
  tickZdIndexJob,
  type ZdIndexJobState,
} from "@/lib/subiekt/zd-index-job";
import {
  fetchZdUnmappedKhReport,
  type ZdUnmappedKhReport,
} from "@/lib/subiekt/zd-unmapped-kh";
import {
  continueZdImportAllSuppliersJob,
  readZdImportAllSuppliersJobState,
  startZdImportAllSuppliersJob,
  stopZdImportAllSuppliersJob,
  tickZdImportAllSuppliersJob,
  type ZdImportAllSuppliersJobState,
} from "@/lib/subiekt/zd-import-all-suppliers-job";
import {
  readCatalogZdSyncState,
  runCatalogZdSync,
  type CatalogZdSyncState,
} from "@/lib/subiekt/catalog-zd-sync";
import { readCronRun, type CronRunPayload } from "@/lib/services/cron-run-log";

const MAX_NOTE_LEN = 500;

export async function actionFetchProductCatalogPage(options?: {
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  await requireAdmin();
  return fetchProductCatalogPage(options);
}

export async function actionSearchProductCatalogPage(options: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  await requireAdmin();
  return searchProductCatalogPage(options);
}

export async function actionCountProductCatalogCoverage(): Promise<ProductCatalogCoverageStats> {
  await requireAdmin();
  return countProductCatalogCoverage();
}

export async function actionFetchProductsWithoutSupplierPage(options?: {
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  await requireAdmin();
  return fetchProductsWithoutSupplierPage(options);
}

export async function actionSearchProductsWithoutSupplierPage(options: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  await requireAdmin();
  return searchProductsWithoutSupplierPage(options);
}

export async function actionUpdateSubiektProductNote(subiektTwId: number, note: string) {
  await requireAdminForMutation();
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

export async function actionListCatalogAssignSuppliers(): Promise<
  Array<{ id: string; name: string; subiektKhId: number | null }>
> {
  await requireAdmin();
  const refs = await getAppSupplierRefsCached();
  return refs.map((s) => ({
    id: s.id,
    name: s.name,
    subiektKhId: s.subiektKhId ?? null,
  }));
}

export async function actionAssignProductSupplier(
  subiektTwId: number,
  supplierId: string
): Promise<{
  row: ProductCatalogRow;
  autoAssign: { updated: number; promoted: number };
}> {
  await requireAdminForMutation();
  const twId = Math.trunc(subiektTwId);
  await assignProductSupplierLinkAdmin({ subiektTwId: twId, supplierId });

  const supabase = createAdminClient();
  const { data: pendingOrders, error: ordErr } = await supabase
    .from("individual_orders")
    .select("id")
    .eq("subiekt_tw_id", twId)
    .eq("status", "Weryfikacja")
    .is("supplier_id", null);
  if (ordErr) throw new Error(ordErr.message);

  const orderIds = (pendingOrders ?? []).map((o) => String((o as { id: string }).id));
  const autoAssign = orderIds.length
    ? await autoAssignMissingSuppliersFromCatalog({ orderIds, limit: orderIds.length })
    : { checked: 0, updated: 0, promoted: 0 };

  const rows = await fetchProductCatalogRowsByTwIds([twId]);
  const row = rows[0];
  if (!row) throw new Error("Nie udało się odczytać produktu po zapisie.");

  revalidatePath("/admin/produkty");
  revalidatePath("/weryfikacja");
  revalidatePath("/podsumowanie");

  return { row, autoAssign: { updated: autoAssign.updated, promoted: autoAssign.promoted } };
}

export async function actionRebuildProductCatalogFromOrders(options?: { limit?: number }) {
  await requireAdminForMutation();
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
  await requireAdminForMutation();
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

export async function actionListSubiektLinkedSuppliers(): Promise<
  Array<{ id: string; name: string; subiekt_kh_id: number }>
> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .not("subiekt_kh_id", "is", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((s) => ({
      id: String(s.id),
      name: String(s.name ?? ""),
      subiekt_kh_id: Number(s.subiekt_kh_id),
    }))
    .filter((s) => Number.isFinite(s.subiekt_kh_id) && s.subiekt_kh_id > 0);
}

export async function actionSupplierProductLinkStats(): Promise<
  Array<{
    id: string;
    name: string;
    subiekt_kh_id: number;
    linksTotal: number;
    linksZdImport: number;
  }>
> {
  await requireAdmin();
  const supabase = createAdminClient();

  const suppliers = await actionListSubiektLinkedSuppliers();
  const out: Array<{
    id: string;
    name: string;
    subiekt_kh_id: number;
    linksTotal: number;
    linksZdImport: number;
  }> = [];

  for (const s of suppliers) {
    const [{ count: total }, { count: zd }] = await Promise.all([
      supabase
        .from("product_supplier_links")
        .select("subiekt_tw_id", { count: "exact", head: true })
        .eq("supplier_id", s.id),
      supabase
        .from("product_supplier_links")
        .select("subiekt_tw_id", { count: "exact", head: true })
        .eq("supplier_id", s.id)
        .eq("last_source", "zd_import"),
    ]);
    out.push({
      ...s,
      linksTotal: Number(total ?? 0),
      linksZdImport: Number(zd ?? 0),
    });
  }

  return out;
}

export async function actionReadZdImportSupplierJob(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  await requireAdmin();
  return readZdImportSupplierJobState(supplierId);
}

export async function actionStartZdImportSupplierJob(input: {
  supplierId: string;
  monthsBack?: number;
}): Promise<ZdImportSupplierJobState> {
  await requireAdminForMutation();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .eq("id", input.supplierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie znaleziono dostawcy.");
  const supplier = data as { id: string; name: string | null; subiekt_kh_id: number | null };
  const khId = Number(supplier.subiekt_kh_id);
  if (!Number.isFinite(khId) || khId <= 0) {
    throw new Error("Dostawca nie ma powiązania z Subiektem (subiekt_kh_id).");
  }
  return startZdImportForSupplier({
    supplierId: String(supplier.id),
    supplierName: String(supplier.name ?? "Dostawca"),
    subiektKhId: khId,
    monthsBack: input.monthsBack ?? 60,
    batchDocs: 3,
  });
}

export async function actionTickZdImportSupplierJob(input: {
  supplierId: string;
  maxDocs?: number;
}): Promise<ZdImportSupplierJobState> {
  await requireAdminForMutation();
  const next = await tickZdImportForSupplier({
    supplierId: input.supplierId,
    maxDocs: input.maxDocs ?? 3,
  });
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionStopZdImportSupplierJob(supplierId: string) {
  await requireAdminForMutation();
  const next = await stopZdImportForSupplier(supplierId);
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionContinueZdImportSupplierJob(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  await requireAdminForMutation();
  const next = await continueZdImportForSupplier(supplierId);
  revalidatePath("/admin/produkty");
  return next;
}

/** Usuwa mapowania ZD i resetuje flagi importu — przygotowanie do ponownego importu. */
export async function actionCleanupZdImportForSupplier(
  supplierId: string,
  options?: { monthsBack?: number }
): Promise<{
  success: true;
  removedLinks: number;
  resetZdFlags: number;
}> {
  await requireAdminForMutation();
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("product_supplier_links")
    .delete({ count: "exact" })
    .eq("supplier_id", supplierId)
    .eq("last_source", "zd_import");
  if (error) throw new Error(error.message);

  const { defaultZdSearchDataOd } = await import("@/lib/subiekt/subiekt-runtime-cache");
  const { resetZdCatalogImportFlagsForSupplier } = await import(
    "@/lib/subiekt/zd-catalog-import"
  );
  const dataOd = defaultZdSearchDataOd(options?.monthsBack ?? 60);
  const resetZdFlags = await resetZdCatalogImportFlagsForSupplier(supplierId, dataOd);
  await clearZdImportSupplierJobState(supplierId);

  revalidatePath("/admin/produkty");
  return { success: true, removedLinks: count ?? 0, resetZdFlags };
}

export async function actionReadZdIndexJob(): Promise<ZdIndexJobState | null> {
  await requireAdmin();
  return readZdIndexJobState();
}

export async function actionStartZdIndexJob(options?: { monthsBack?: number }) {
  await requireAdminForMutation();
  return startZdIndexJob({ monthsBack: options?.monthsBack ?? 60, pageSize: 25 });
}

export async function actionTickZdIndexJob(options?: { maxDocs?: number }): Promise<ZdIndexJobState> {
  await requireAdminForMutation();
  const next = await tickZdIndexJob({ maxDocs: options?.maxDocs ?? 3 });
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionStopZdIndexJob() {
  await requireAdminForMutation();
  const next = await stopZdIndexJob();
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionContinueZdIndexJob(): Promise<ZdIndexJobState | null> {
  await requireAdminForMutation();
  const next = await continueZdIndexJob();
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionListZdUnmappedKh(): Promise<ZdUnmappedKhReport> {
  await requireAdmin();
  return fetchZdUnmappedKhReport();
}

export async function actionReadZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState | null> {
  await requireAdmin();
  return readZdImportAllSuppliersJobState();
}

export async function actionStartZdImportAllSuppliersJob(options?: {
  monthsBack?: number;
  batchDocs?: number;
}): Promise<ZdImportAllSuppliersJobState> {
  await requireAdminForMutation();
  // Domyślnie bierzemy szerszy zakres niż dawniej, bo katalog produktów ma być możliwie kompletny.
  const { defaultZdSearchDataOd } = await import("@/lib/subiekt/subiekt-runtime-cache");
  const monthsBack = options?.monthsBack ?? 60;
  const batchDocs = options?.batchDocs ?? 3;
  return startZdImportAllSuppliersJob({ dataOd: defaultZdSearchDataOd(monthsBack), batchDocs });
}

export async function actionTickZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState> {
  await requireAdminForMutation();
  const next = await tickZdImportAllSuppliersJob({ maxDocs: 3 });
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionStopZdImportAllSuppliersJob() {
  await requireAdminForMutation();
  const next = await stopZdImportAllSuppliersJob();
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionContinueZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState | null> {
  await requireAdminForMutation();
  const next = await continueZdImportAllSuppliersJob();
  revalidatePath("/admin/produkty");
  return next;
}

export async function actionReadCatalogZdSyncStatus(): Promise<{
  state: CatalogZdSyncState | null;
  lastCron: CronRunPayload | null;
}> {
  await requireAdmin();
  const [state, lastCron] = await Promise.all([
    readCatalogZdSyncState(),
    readCronRun("catalog_zd_sync"),
  ]);
  return { state, lastCron };
}

/** Kontynuacja przerwanego przebiegu (bez resetu stanu). */
export async function actionContinueCatalogZdSync() {
  await requireAdminForMutation();
  if (!(await isSubiektReachable())) {
    throw new Error("Subiekt niedostępny — synchronizacja wymaga LAN.");
  }
  const result = await runCatalogZdSync({
    force: true,
    maxDurationMs: 2 * 60 * 1000,
  });
  revalidatePath("/admin/produkty");
  return result;
}

/** Test / ponowny przebieg — `reset` tylko gdy jawnie żądany (domyślnie kontynuuje). */
export async function actionRunCatalogZdSyncNow(options?: { reset?: boolean }) {
  await requireAdminForMutation();
  if (!(await isSubiektReachable())) {
    throw new Error("Subiekt niedostępny — synchronizacja wymaga LAN.");
  }
  const result = await runCatalogZdSync({
    force: true,
    reset: options?.reset === true,
    maxDurationMs: 2 * 60 * 1000,
  });
  revalidatePath("/admin/produkty");
  return result;
}

