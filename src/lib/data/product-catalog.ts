import { createAdminClient } from "@/lib/supabase/admin";
import { query } from "@/lib/db/pool";

export type ProductCatalogSource = "order_history" | "procurement_verification" | "zd_import" | "admin_note";

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertSubiektProduct(input: {
  subiektTwId: number;
  symbol?: string | null;
  name?: string | null;
  plu?: string | null;
  seenAt?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const seenAt = input.seenAt ?? nowIso();
  const { error } = await supabase.from("subiekt_products").upsert(
    {
      subiekt_tw_id: Math.trunc(input.subiektTwId),
      symbol: input.symbol ?? null,
      name: input.name ?? null,
      plu: input.plu ?? null,
      updated_at: nowIso(),
      last_seen_at: seenAt,
    },
    { onConflict: "subiekt_tw_id" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Dostawca przypięty ręcznie w /admin/produkty. Gdy jest, automaty (ZD, historia zamówień)
 * nie zakładają ani nie podbijają linków do innych dostawców tego towaru.
 */
export async function fetchManualSupplierPins(twIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(twIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id) && id > 0))];
  const pins = new Map<number, string>();
  if (!ids.length) return pins;
  const res = await query<{ subiekt_tw_id: number; manual_supplier_id: string }>(
    `SELECT subiekt_tw_id, manual_supplier_id::text AS manual_supplier_id
       FROM subiekt_products
      WHERE subiekt_tw_id = ANY($1::int[]) AND manual_supplier_id IS NOT NULL`,
    [ids]
  );
  for (const row of res.rows) pins.set(Number(row.subiekt_tw_id), String(row.manual_supplier_id));
  return pins;
}

async function blockedByManualPin(subiektTwId: number, supplierId: string): Promise<boolean> {
  const pinned = (await fetchManualSupplierPins([subiektTwId])).get(Math.trunc(subiektTwId));
  return pinned != null && pinned !== supplierId;
}

export async function bumpProductSupplierLink(input: {
  subiektTwId: number;
  supplierId: string;
  orderId?: string | null;
  source: Exclude<ProductCatalogSource, "admin_note">;
  actionAt?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const subiektTwId = Math.trunc(input.subiektTwId);
  const actionAt = input.actionAt ?? nowIso();
  if (await blockedByManualPin(subiektTwId, input.supplierId)) return;

  // Nie ma atomowego "upsert + increment" w supabase-js bez RPC.
  // Skala jest mała, więc robimy read-modify-write.
  const { data: existing, error: fetchError } = await supabase
    .from("product_supplier_links")
    .select("order_count")
    .eq("subiekt_tw_id", subiektTwId)
    .eq("supplier_id", input.supplierId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  const nextCount = (existing?.order_count ?? 0) + 1;

  const { error } = await supabase.from("product_supplier_links").upsert(
    {
      subiekt_tw_id: subiektTwId,
      supplier_id: input.supplierId,
      order_count: nextCount,
      last_action_at: actionAt,
      last_order_id: input.orderId ?? null,
      last_source: input.source,
      updated_at: nowIso(),
    },
    { onConflict: "subiekt_tw_id,supplier_id" }
  );
  if (error) throw new Error(error.message);
}

export async function bumpProductSupplierLinkBy(input: {
  subiektTwId: number;
  supplierId: string;
  delta: number;
  lastSource: Exclude<ProductCatalogSource, "admin_note">;
  lastActionAt?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const subiektTwId = Math.trunc(input.subiektTwId);
  const delta = Math.trunc(input.delta);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const actionAt = input.lastActionAt ?? nowIso();
  if (await blockedByManualPin(subiektTwId, input.supplierId)) return;

  const { data: existing, error: fetchError } = await supabase
    .from("product_supplier_links")
    .select("order_count, note, last_source")
    .eq("subiekt_tw_id", subiektTwId)
    .eq("supplier_id", input.supplierId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const nextCount = (existing?.order_count ?? 0) + delta;
  const existingSource = (existing?.last_source as string | null) ?? null;
  const keepSource =
    existingSource && existingSource !== "zd_import" ? existingSource : input.lastSource;

  const { error } = await supabase.from("product_supplier_links").upsert(
    {
      subiekt_tw_id: subiektTwId,
      supplier_id: input.supplierId,
      order_count: nextCount,
      last_action_at: actionAt,
      last_source: keepSource,
      note: existing?.note ?? "",
      updated_at: nowIso(),
    },
    { onConflict: "subiekt_tw_id,supplier_id" }
  );
  if (error) throw new Error(error.message);
}

export async function recordProductEvent(input: {
  subiektTwId: number;
  supplierId?: string | null;
  orderId?: string | null;
  source: ProductCatalogSource;
  action: "seen" | "link_upserted" | "note_updated";
  detail?: Record<string, unknown> | null;
  at?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("product_events").insert({
    subiekt_tw_id: Math.trunc(input.subiektTwId),
    supplier_id: input.supplierId ?? null,
    order_id: input.orderId ?? null,
    source: input.source,
    action: input.action,
    detail: input.detail ?? null,
    created_at: input.at ?? nowIso(),
  });
  if (error) throw new Error(error.message);
}

/** order_count linku po ręcznym przypisaniu — nie niższy niż dotychczasowy główny dostawca. */
export function adminAssignPrimaryOrderCount(
  links: Array<{ supplierId: string; orderCount: number }>,
  targetSupplierId: string
): number {
  const target = links.find((l) => l.supplierId === targetSupplierId);
  const maxOther = links
    .filter((l) => l.supplierId !== targetSupplierId)
    .reduce((max, l) => Math.max(max, l.orderCount), 0);
  return Math.max(target?.orderCount ?? 0, maxOther + 1, 1);
}

export const PRODUCT_CATALOG_BULK_ASSIGN_MAX = 150;

export function normalizeProductCatalogBulkTwIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of ids) {
    const id = Math.trunc(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= PRODUCT_CATALOG_BULK_ASSIGN_MAX) break;
  }
  return out;
}

/** Ręczne mapowanie produkt → dostawca z panelu admina (/admin/produkty). */
export async function assignProductSupplierLinkAdmin(input: {
  subiektTwId: number;
  supplierId: string;
}): Promise<{ supplierId: string; supplierName: string; orderCount: number }> {
  const supabase = createAdminClient();
  const subiektTwId = Math.trunc(input.subiektTwId);
  const supplierId = input.supplierId.trim();
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) {
    throw new Error("Nieprawidłowy identyfikator produktu (tw_Id).");
  }
  if (!supplierId) throw new Error("Wybierz dostawcę.");

  const { data: product, error: prodErr } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id")
    .eq("subiekt_tw_id", subiektTwId)
    .maybeSingle();
  if (prodErr) throw new Error(prodErr.message);
  if (!product) throw new Error("Produkt nie istnieje w katalogu - najpierw zapisz go z prośby lub importu ZD.");

  const { data: supplier, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .maybeSingle();
  if (supErr) throw new Error(supErr.message);
  if (!supplier) throw new Error("Nie znaleziono dostawcy.");

  const { data: allLinks, error: linksErr } = await supabase
    .from("product_supplier_links")
    .select("supplier_id, order_count")
    .eq("subiekt_tw_id", subiektTwId);
  if (linksErr) throw new Error(linksErr.message);

  const at = nowIso();
  const orderCount = adminAssignPrimaryOrderCount(
    (allLinks ?? []).map((row) => ({
      supplierId: String(row.supplier_id),
      orderCount: Number(row.order_count ?? 0),
    })),
    supplierId
  );

  const { error } = await supabase.from("product_supplier_links").upsert(
    {
      subiekt_tw_id: subiektTwId,
      supplier_id: supplierId,
      order_count: orderCount,
      last_action_at: at,
      last_source: "procurement_verification",
      updated_at: at,
    },
    { onConflict: "subiekt_tw_id,supplier_id" }
  );
  if (error) throw new Error(error.message);

  // Ręczny wybór jest ostateczny: towar znika z list innych dostawców i nie wraca z importu ZD.
  await query(`UPDATE subiekt_products SET manual_supplier_id = $2::uuid, updated_at = now() WHERE subiekt_tw_id = $1`, [
    subiektTwId,
    supplierId,
  ]);
  const removed = await query(
    `DELETE FROM product_supplier_links WHERE subiekt_tw_id = $1 AND supplier_id <> $2::uuid`,
    [subiektTwId, supplierId]
  );

  await recordProductEvent({
    subiektTwId,
    supplierId,
    source: "procurement_verification",
    action: "link_upserted",
    detail: { manualAdmin: true, removedOtherLinks: removed.rowCount ?? 0 },
    at,
  });

  return {
    supplierId,
    supplierName: String(supplier.name ?? "Dostawca"),
    orderCount,
  };
}

export async function indexOrderLineToProductCatalog(input: {
  orderId?: string | null;
  subiektTwId: number | null;
  symbol?: string | null;
  productName?: string | null;
  mikranCode?: string | null;
  supplierId?: string | null;
  actionAt?: string | null;
  source: Exclude<ProductCatalogSource, "admin_note">;
  /** Domyślnie: true gdy podano supplierId. U zakupów ustaw false bez tw_Id z Subiekta. */
  linkSupplier?: boolean;
}): Promise<void> {
  if (input.subiektTwId == null || input.subiektTwId <= 0) return;

  await upsertSubiektProduct({
    subiektTwId: input.subiektTwId,
    symbol: (input.symbol ?? "").trim() || null,
    name: (input.productName ?? "").trim() || null,
    plu: (input.mikranCode ?? "").trim() || null,
    seenAt: input.actionAt ?? undefined,
  });

  await recordProductEvent({
    subiektTwId: input.subiektTwId,
    supplierId: input.supplierId ?? null,
    orderId: input.orderId ?? null,
    source: input.source,
    action: "seen",
    at: input.actionAt ?? undefined,
  });

  const linkSupplier = input.linkSupplier ?? Boolean(input.supplierId?.trim());
  if (input.supplierId && linkSupplier) {
    await bumpProductSupplierLink({
      subiektTwId: input.subiektTwId,
      supplierId: input.supplierId,
      orderId: input.orderId,
      source: input.source,
      actionAt: input.actionAt ?? undefined,
    });
    await recordProductEvent({
      subiektTwId: input.subiektTwId,
      supplierId: input.supplierId,
      orderId: input.orderId,
      source: input.source,
      action: "link_upserted",
      at: input.actionAt ?? undefined,
    });
  }
}


/** Notatka zakupów przy towarze (np. „taniej od 10 opak.”) — ta sama, co w katalogu produktów admina. */
export async function fetchSubiektProductNote(subiektTwId: number): Promise<string> {
  const res = await query<{ note: string | null }>(`SELECT note FROM subiekt_products WHERE subiekt_tw_id = $1`, [
    Math.trunc(subiektTwId),
  ]);
  return res.rows[0]?.note ?? "";
}

/** Zapis notatki; towaru może jeszcze nie być w katalogu (Kreator czyta Subiekta) — wtedy powstaje wiersz. */
export async function saveSubiektProductNote(input: { subiektTwId: number; note: string; symbol?: string | null; name?: string | null }): Promise<void> {
  // Pusta notatka tylko czyści istniejącą — nie zakłada w katalogu pustego wiersza dla towaru spoza niego.
  if (!input.note) {
    await query(`UPDATE subiekt_products SET note = '', updated_at = now() WHERE subiekt_tw_id = $1 AND note <> ''`, [
      Math.trunc(input.subiektTwId),
    ]);
    return;
  }
  await query(
    `INSERT INTO subiekt_products (subiekt_tw_id, symbol, name, note, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (subiekt_tw_id) DO UPDATE SET note = EXCLUDED.note, updated_at = now(),
       symbol = coalesce(subiekt_products.symbol, EXCLUDED.symbol), name = coalesce(subiekt_products.name, EXCLUDED.name)`,
    [Math.trunc(input.subiektTwId), input.symbol ?? null, input.name ?? null, input.note]
  );
}
