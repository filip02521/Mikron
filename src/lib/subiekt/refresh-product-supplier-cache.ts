import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import {
  listStaleProductSupplierCacheRows,
  touchProductSupplierCache,
  upsertCachedSupplierForSubiektProduct,
} from "@/lib/data/product-supplier-cache";
import { getSubiektProduct } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { dedupeAppSuppliersByKhId } from "@/lib/subiekt/dedupe-suppliers-by-kh";
import { lookupSupplierForSubiektProduct } from "@/lib/subiekt/product-supplier";

export async function refreshProductSupplierCacheBatch(options?: {
  limit?: number;
  staleAfterDays?: number;
}): Promise<{
  scanned: number;
  updated: number;
  touched: number;
  skippedOffline: boolean;
}> {
  const offline = !(await isSubiektReachable());
  if (offline) {
    return { scanned: 0, updated: 0, touched: 0, skippedOffline: true };
  }

  const rows = await listStaleProductSupplierCacheRows(options);
  if (!rows.length) {
    return { scanned: 0, updated: 0, touched: 0, skippedOffline: false };
  }

  const appSuppliers = dedupeAppSuppliersByKhId(await getAppSupplierRefsCached());
  const supabase = createAdminClient();

  let updated = 0;
  let touched = 0;

  for (const row of rows) {
    const twId = row.subiekt_tw_id;
    try {
      const product = await getSubiektProduct(twId);
      const lookup = await lookupSupplierForSubiektProduct(product, appSuppliers);
      if (lookup.status === "mapped") {
        await upsertCachedSupplierForSubiektProduct({
          subiektTwId: twId,
          supplierId: lookup.supplierId,
          source: "zd",
        });
        updated++;
        continue;
      }

      // Brak nowego dopasowania — tylko “touch”, żeby nie mielić w kółko.
      await touchProductSupplierCache(twId);
      touched++;
    } catch (e) {
      // Fail soft: oznacz jako odświeżone, żeby nie zapętlać się na problematycznym twId.
      await supabase
        .from("product_supplier_cache")
        .update({ updated_at: new Date().toISOString() })
        .eq("subiekt_tw_id", Math.trunc(twId));
      touched++;
    }
  }

  return {
    scanned: rows.length,
    updated,
    touched,
    skippedOffline: false,
  };
}

