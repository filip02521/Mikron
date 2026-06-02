import {
  arrivedByKeyFromChecks,
  buildZkWatchLineViews,
  checksFromLineViews,
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import { normalizeMyOrderSearchText } from "@/lib/orders/my-order-search";
import type { SalesZkWatch } from "@/types/database";

export type ZkLinkableOrder = {
  id: string;
  sales_person_id: string;
  sales_client_name: string | null;
  sales_client_kh_id: number | null;
  subiekt_tw_id: number | null;
  symbol: string | null;
  products: string | null;
  mikran_code: string | null;
  status: string;
  sales_acknowledged_at: string | null;
  sales_cancelled_at: string | null;
};

export type ZkWatchOrderHints = {
  /** Aktywne prośby tego klienta z dopasowanym towarem (w toku). */
  matchingOpenRequestCount: number;
  /** Pozycje ZK, dla których jest już zrealizowana prośba (do podświetlenia). */
  matchedDeliveredLineKeys: string[];
  /** Czy wszystkie pozycje towarowe są „na miejscu” wg prośb. */
  allLinesMatchedByOrders: boolean;
};

const DELIVERED_STATUSES = new Set(["Zrealizowane", "Czesciowo_zrealizowane"]);

const OPEN_PROSBA_STATUSES = new Set([
  "Nowe",
  "Weryfikacja",
  "Zamowione",
  "Czesciowo_zrealizowane",
]);

function normalizeKhId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Porównanie etykiet klienta (bez polskich znaków, zawiera). */
export function clientLabelsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeMyOrderSearchText(a ?? "");
  const nb = normalizeMyOrderSearchText(b ?? "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

export function clientsMatchForZk(
  watch: Pick<SalesZkWatch, "client_kh_id" | "client_label">,
  order: Pick<ZkLinkableOrder, "sales_client_kh_id" | "sales_client_name">
): boolean {
  const watchKh = normalizeKhId(watch.client_kh_id);
  const orderKh = normalizeKhId(order.sales_client_kh_id);
  if (watchKh != null && orderKh != null) return watchKh === orderKh;
  if (watchKh != null && orderKh == null) {
    return clientLabelsMatchExact(watch.client_label, order.sales_client_name);
  }
  if (watchKh == null && orderKh != null) {
    return clientLabelsMatchExact(watch.client_label, order.sales_client_name);
  }
  return clientLabelsMatch(watch.client_label, order.sales_client_name);
}

/** Dokładne dopasowanie etykiety (bez zawierania) — gdy jedna strona ma kh, a druga nie. */
export function clientLabelsMatchExact(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeMyOrderSearchText(a ?? "");
  const nb = normalizeMyOrderSearchText(b ?? "");
  return Boolean(na && nb && na === nb);
}

function normalizeProductToken(value: string | null | undefined): string {
  return normalizeMyOrderSearchText(value ?? "");
}

export function productMatchesZkLine(
  order: ZkLinkableOrder,
  line: ZkWatchLineView
): boolean {
  const orderTw = normalizeKhId(order.subiekt_tw_id);
  if (line.subiektTwId != null && orderTw != null) {
    return line.subiektTwId === orderTw;
  }

  const sym = normalizeProductToken(order.symbol);
  const lineSym = normalizeProductToken(line.symbol);
  if (sym && lineSym && (sym === lineSym || sym.includes(lineSym) || lineSym.includes(sym))) {
    return true;
  }

  const orderName = normalizeProductToken(order.products);
  const lineName = normalizeProductToken(line.product);
  if (!orderName || !lineName) return false;
  if (orderName === lineName) return true;
  return orderName.includes(lineName) || lineName.includes(orderName);
}

export function isDeliveredOrderStatus(status: string): boolean {
  return DELIVERED_STATUSES.has(status);
}

export function isOpenProsbaOrder(order: ZkLinkableOrder): boolean {
  if (order.sales_acknowledged_at || order.sales_cancelled_at) return false;
  return OPEN_PROSBA_STATUSES.has(order.status);
}

export function filterZkWatchesByClientQuery(
  watches: SalesZkWatch[],
  query: string
): SalesZkWatch[] {
  const q = normalizeMyOrderSearchText(query);
  if (!q) return watches;
  return watches.filter((w) => {
    const label = normalizeMyOrderSearchText(w.client_label);
    const zk = normalizeMyOrderSearchText(w.zk_number);
    return label.includes(q) || zk.includes(q);
  });
}

export function computeZkWatchOrderHints(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): ZkWatchOrderHints {
  const lineViews = buildZkWatchLineViews(watch);
  const relevant = orders.filter(
    (o) => o.sales_person_id === watch.sales_person_id && clientsMatchForZk(watch, o)
  );

  let matchingOpenRequestCount = 0;
  const matchedDeliveredLineKeys = new Set<string>();

  for (const order of relevant) {
    const matchedLines = lineViews.filter((line) => productMatchesZkLine(order, line));
    if (!matchedLines.length) continue;

    if (isOpenProsbaOrder(order)) {
      matchingOpenRequestCount += 1;
    }
    if (isDeliveredOrderStatus(order.status)) {
      for (const line of matchedLines) {
        matchedDeliveredLineKeys.add(line.key);
      }
    }
  }

  const productLines = lineViews.filter((l) => l.key !== "summary");
  const allLinesMatchedByOrders =
    productLines.length > 0 &&
    productLines.every((l) => matchedDeliveredLineKeys.has(l.key));

  return {
    matchingOpenRequestCount,
    matchedDeliveredLineKeys: [...matchedDeliveredLineKeys],
    allLinesMatchedByOrders,
  };
}

/** Po dostawie — zaznacz pozycje ZK jako „na miejscu”. */
export function mergeZkLineChecksFromDeliveredOrders(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): { checks: ZkWatchLineCheckStored[]; changed: boolean } {
  const views = buildZkWatchLineViews(watch);
  const previous = parseZkWatchLineChecks(watch.line_checks);
  const arrived = arrivedByKeyFromChecks(previous);

  const relevantDelivered = orders.filter(
    (o) =>
      o.sales_person_id === watch.sales_person_id &&
      clientsMatchForZk(watch, o) &&
      isDeliveredOrderStatus(o.status)
  );

  for (const line of views) {
    if (arrived.get(line.key)) continue;
    if (relevantDelivered.some((order) => productMatchesZkLine(order, line))) {
      arrived.set(line.key, true);
    }
  }

  const next = views.map((v) => ({
    key: v.key,
    arrived: arrived.get(v.key) ?? false,
  }));

  const changed =
    JSON.stringify(previous) !== JSON.stringify(next);

  return { checks: next, changed };
}

export function checksFromMergedViews(
  watch: SalesZkWatch,
  checks: ZkWatchLineCheckStored[]
): ZkWatchLineCheckStored[] {
  const views = buildZkWatchLineViews(watch);
  const keys = new Set(views.map((v) => v.key));
  return checks.filter((c) => keys.has(c.key));
}

export { checksFromLineViews };
