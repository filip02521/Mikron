import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Ręczne przypisanie w panelu admina ustawia „głównego” dostawcę w katalogu
 * (najwyższy order_count). Starsze linki zostają w historii z niższym priorytetem.
 */
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
  if (!product) throw new Error("Produkt nie istnieje w katalogu — najpierw zapisz go z prośby lub importu ZD.");

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

  await recordProductEvent({
    subiektTwId,
    supplierId,
    source: "procurement_verification",
    action: "link_upserted",
    detail: { manualAdmin: true },
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

