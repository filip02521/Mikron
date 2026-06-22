import {
  PROSBA_STOCK_FETCH_MAX_CONCURRENT,
  PROSBA_STOCK_FETCH_SERVER_TIMEOUT_MS,
  stockSnapshotFromSubiektProduct,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { isSubiektConfigured } from "@/lib/subiekt/config";
import { getSubiektProduct } from "@/lib/subiekt/api";

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (!items.length) return;
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

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

  const fetchAll = async () => {
    await mapWithConcurrency(unique, PROSBA_STOCK_FETCH_MAX_CONCURRENT, async (id) => {
      try {
        const product = await getSubiektProduct(id);
        const snap = stockSnapshotFromSubiektProduct(product);
        if (snap) out[id] = snap;
      } catch {
        /* pojedynczy towar — pomijamy */
      }
    });
    return out;
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Record<number, ProsbaLineStockSnapshot>>((resolve) => {
    timeoutId = setTimeout(() => resolve({ ...out }), PROSBA_STOCK_FETCH_SERVER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([fetchAll(), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
