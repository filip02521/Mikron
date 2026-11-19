import { getSubiektProduct } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { fetchPendingRwQtyByTw } from "@/lib/data/service-orders";
import { servicePartAvailable } from "@/lib/orders/service-parts-overview";

/**
 * Ile części, na które czekają zlecenia, jest do wzięcia (ta sama reguła co ekran części serwisowych). Część, której
 * Subiekt nie zwrócił, nie trafia do mapy — panel pokazuje wtedy sam status prośby, bez „część dotarła”.
 */
export async function fetchWaitingPartsAvailable(twIds: readonly number[]): Promise<Map<number, number>> {
  const ids = [...new Set(twIds.filter((id) => Number.isInteger(id) && id > 0))];
  // Bez Subiektu lista zleceń wczytuje się od razu — bez „część dotarła”, nie bez zleceń.
  if (!ids.length || !(await isSubiektReachable())) return new Map();
  const [products, pendingRw] = await Promise.all([
    Promise.allSettled(ids.map((id) => getSubiektProduct(id))),
    fetchPendingRwQtyByTw(),
  ]);
  const out = new Map<number, number>();
  products.forEach((res, i) => {
    if (res.status !== "fulfilled" || !res.value) return;
    out.set(ids[i]!, servicePartAvailable(res.value, pendingRw.get(ids[i]!) ?? 0));
  });
  return out;
}
