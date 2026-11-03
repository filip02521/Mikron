import { query } from "@/lib/db/pool";
import { resolveServicePartsCecha } from "@/lib/data/service-parts";
import { fetchZdEstimateMinStock } from "@/lib/data/zd-estimate-min-stock";
import { searchSubiektOrdersProducts } from "@/lib/subiekt/api";
import type { SubiektProduct } from "@/lib/subiekt/types";
import {
  buildServicePartRows,
  SERVICE_PART_ACTIVE_REQUEST_STATUSES,
  type ServicePartRequest,
  type ServicePartRow,
} from "@/lib/orders/service-parts-overview";
import { SERVICE_PARTS_CECHA_NAME } from "@/lib/orders/service-parts";
import type { IndividualOrderStatus } from "@/types/database";

/** API Subiekta przycina stronę do 200. */
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

export type ServicePartsOverview =
  | { kind: "ok"; cechaName: string; rows: ServicePartRow[]; readAt: string }
  | { kind: "no_cecha"; cechaName: string };

async function fetchProductsWithCecha(cechaId: number): Promise<SubiektProduct[]> {
  const out: SubiektProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await searchSubiektOrdersProducts({ cechaId, page, pageSize: PAGE_SIZE });
    const data = res.data ?? [];
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

async function fetchActiveRequestsByTwId(
  twIds: readonly number[]
): Promise<Map<number, ServicePartRequest[]>> {
  const map = new Map<number, ServicePartRequest[]>();
  if (twIds.length === 0) return map;
  const res = await query<{
    subiekt_tw_id: number;
    status: IndividualOrderStatus;
    quantity: string | null;
    created_at: Date | string;
  }>(
    `SELECT subiekt_tw_id, status, quantity, created_at
       FROM individual_orders
      WHERE subiekt_tw_id = ANY($1::int[])
        AND status::text = ANY($2::text[])
      ORDER BY created_at DESC`,
    [twIds, SERVICE_PART_ACTIVE_REQUEST_STATUSES]
  );
  for (const r of res.rows) {
    const twId = Number(r.subiekt_tw_id);
    const list = map.get(twId) ?? [];
    list.push({
      status: r.status,
      quantity: (r.quantity ?? "").trim() || "-",
      createdAt: new Date(r.created_at).toISOString(),
    });
    map.set(twId, list);
  }
  return map;
}

/** Stany części serwisowych na żywo z Subiekta + aktywne prośby z OnTime. */
export async function loadServicePartsOverview(): Promise<ServicePartsOverview> {
  const cecha = await resolveServicePartsCecha();
  if (!cecha) return { kind: "no_cecha", cechaName: SERVICE_PARTS_CECHA_NAME };
  const [products, minStock] = await Promise.all([
    fetchProductsWithCecha(cecha.cechaId),
    fetchZdEstimateMinStock(),
  ]);
  const twIds = products.map((p) => Math.trunc(Number(p.tw_Id))).filter((id) => id > 0);
  const requestsByTwId = await fetchActiveRequestsByTwId(twIds);
  const minStockByTwId = new Map(minStock.map((m) => [m.subiektTwId, m.minStockSzt]));
  return {
    kind: "ok",
    cechaName: cecha.name,
    rows: buildServicePartRows({ products, minStockByTwId, requestsByTwId }),
    readAt: new Date().toISOString(),
  };
}
