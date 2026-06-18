import { isSubiektReachable } from "@/lib/subiekt/availability";
import { isSubiektConfigured } from "@/lib/subiekt/config";
import { getSubiektProduct } from "@/lib/subiekt/api";
import {
  stockSnapshotFromSubiektProduct,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";

/** Batch stanu magazynowego po tw_Id (serwer / Server Action). */
export async function fetchProsbaLineStock(
  twIds: number[]
): Promise<Record<number, ProsbaLineStockSnapshot>> {
  const unique = [
    ...new Set(twIds.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))),
  ];
  if (unique.length === 0) return {};
  if (!isSubiektConfigured()) return {};

  const reachable = await isSubiektReachable();
  if (!reachable) return {};

  const out: Record<number, ProsbaLineStockSnapshot> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const product = await getSubiektProduct(id);
        const snap = stockSnapshotFromSubiektProduct(product);
        if (snap) out[id] = snap;
      } catch {
        /* pojedynczy towar — pomijamy */
      }
    })
  );
  return out;
}
