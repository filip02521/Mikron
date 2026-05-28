import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { getSubiektProduct } from "@/lib/subiekt/api";
import { lookupSupplierForSubiektProduct } from "@/lib/subiekt/product-supplier";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { recordProductEvent, upsertSubiektProduct, bumpProductSupplierLink } from "@/lib/data/product-catalog";

/**
 * Import produkt → dostawca na podstawie historii ZD w Subiekcie.
 * Uruchamiaj w środowisku, które ma dostęp do Subiekt API (LAN).
 *
 * To NIE jest „dopasowanie w locie” w UI – to batch uzupełniający własną bazę.
 */
export async function importZdLinksBatch(options?: {
  limit?: number;
  onlyMissing?: boolean;
}): Promise<{ processed: number; linked: number; skippedOffline: boolean }> {
  const limit = options?.limit != null ? Math.max(1, Math.min(200, options.limit)) : 60;
  const onlyMissing = options?.onlyMissing ?? true;

  if (!(await isSubiektReachable())) {
    return { processed: 0, linked: 0, skippedOffline: true };
  }

  const supabase = createAdminClient();
  const { data: productsRaw, error } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id, symbol, name, plu")
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const twIds = (productsRaw ?? [])
    .map((p) => Number(p.subiekt_tw_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!twIds.length) return { processed: 0, linked: 0, skippedOffline: false };

  const appSuppliers = await getAppSupplierRefsCached();

  const { data: linksRaw, error: linksErr } = await supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id")
    .in("subiekt_tw_id", twIds);
  if (linksErr) throw new Error(linksErr.message);

  const alreadyLinked = new Set<number>((linksRaw ?? []).map((r) => Number(r.subiekt_tw_id)));

  let processed = 0;
  let linked = 0;

  for (const twId of twIds) {
    if (onlyMissing && alreadyLinked.has(twId)) continue;
    processed += 1;

    try {
      const product = await getSubiektProduct(twId);
      await upsertSubiektProduct({
        subiektTwId: product.tw_Id,
        symbol: (product.tw_Symbol ?? "").trim() || null,
        name: (product.tw_Nazwa ?? "").trim() || null,
        plu:
          typeof product.tw_PLU === "string"
            ? product.tw_PLU.trim() || null
            : product.tw_PLU != null
              ? String(product.tw_PLU).trim() || null
              : null,
      });

      const lookup = await lookupSupplierForSubiektProduct(product, appSuppliers);
      if (lookup.status === "mapped") {
        await bumpProductSupplierLink({
          subiektTwId: product.tw_Id,
          supplierId: lookup.supplierId,
          orderId: null,
          source: "zd_import",
          actionAt: new Date().toISOString(),
        });
        await recordProductEvent({
          subiektTwId: product.tw_Id,
          supplierId: lookup.supplierId,
          orderId: null,
          source: "zd_import",
          action: "link_upserted",
          detail: { supplierName: lookup.supplierName, subiektLabel: lookup.subiektLabel },
        });
        linked += 1;
      } else if (lookup.status === "unmapped") {
        await recordProductEvent({
          subiektTwId: product.tw_Id,
          supplierId: null,
          orderId: null,
          source: "zd_import",
          action: "seen",
          detail: { subiektLabel: lookup.subiektLabel, documentNumber: lookup.documentNumber },
        });
      } else {
        await recordProductEvent({
          subiektTwId: product.tw_Id,
          supplierId: null,
          orderId: null,
          source: "zd_import",
          action: "seen",
          detail: { status: lookup.status },
        });
      }
    } catch (e) {
      await recordProductEvent({
        subiektTwId: twId,
        supplierId: null,
        orderId: null,
        source: "zd_import",
        action: "seen",
        detail: { error: e instanceof Error ? e.message : "error" },
      });
    }
  }

  return { processed, linked, skippedOffline: false };
}

