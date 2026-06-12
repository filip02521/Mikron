import {
  arrivedByKeyFromChecks,
  buildZkWatchLineViews,
  checksFromLineViews,
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import { normalizeMyOrderSearchText } from "@/lib/orders/my-order-search";
import {
  clientsMatchForSalesClient,
  normalizeSalesClientKhId,
} from "@/lib/orders/sales-client-match";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import { isZkWatchArchived } from "@/lib/data/sales-notepad";
import { getDeliveryProgress } from "@/lib/orders/individual";
import {
  activeOrderQuantity,
  hasActiveSupplierFulfillment,
} from "@/lib/orders/sales-cancel";
import type { SalesZkWatch } from "@/types/database";

export { clientLabelsMatch, clientLabelsMatchExact } from "@/lib/orders/sales-client-match";

export type ZkLinkableOrder = {
  id: string;
  sales_person_id: string;
  sales_client_name: string | null;
  sales_client_kh_id: number | null;
  source_zk_watch_id: string | null;
  source_zk_number: string | null;
  subiekt_tw_id: number | null;
  symbol: string | null;
  products: string | null;
  mikran_code: string | null;
  quantity: string;
  delivered_quantity: string;
  status: string;
  sales_acknowledged_at: string | null;
  sales_cancelled_at: string | null;
};

function orderHasExplicitZkLink(
  order: Pick<ZkLinkableOrder, "source_zk_watch_id" | "source_zk_number">
): boolean {
  return Boolean(order.source_zk_watch_id?.trim() || order.source_zk_number?.trim());
}

export { orderHasExplicitZkLink };

function orderRelevantToZkWatch(
  order: ZkLinkableOrder,
  watch: SalesZkWatch
): boolean {
  if (order.sales_person_id !== watch.sales_person_id) return false;
  if (orderHasExplicitZkLink(order)) {
    return orderExplicitlyLinkedToZkWatch(order, watch);
  }
  return clientsMatchForZk(watch, order);
}

/** Czy zmiana tej prośby może wpłynąć na line_checks danego ZK. */
export function isOrderRelevantToZkWatch(
  order: ZkLinkableOrder,
  watch: SalesZkWatch
): boolean {
  return orderRelevantToZkWatch(order, watch);
}

/** Z listy otwartych ZK zwraca te, które wymagają sync po zmianie prośby. */
export function resolveZkWatchIdsForOrderSync(
  order: ZkLinkableOrder,
  watches: SalesZkWatch[]
): string[] {
  const ids: string[] = [];
  for (const watch of watches) {
    if (isZkWatchArchived(watch)) continue;
    if (orderRelevantToZkWatch(order, watch)) ids.push(watch.id);
  }
  return ids;
}

export type ZkWatchOrderHints = {
  /** Aktywne prośby tego klienta z dopasowanym towarem (w toku). */
  matchingOpenRequestCount: number;
  /** ID aktywnych prośb powiązanych z tym ZK (do focusu na /moje). */
  matchingOpenRequestIds: string[];
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

export function clientsMatchForZk(
  watch: Pick<SalesZkWatch, "client_kh_id" | "client_label">,
  order: Pick<ZkLinkableOrder, "sales_client_kh_id" | "sales_client_name">
): boolean {
  return clientsMatchForSalesClient(
    { client_kh_id: watch.client_kh_id, client_label: watch.client_label },
    order
  );
}

function normalizeProductToken(value: string | null | undefined): string {
  return normalizeMyOrderSearchText(value ?? "");
}

export function productMatchesZkLine(
  order: ZkLinkableOrder,
  line: ZkWatchLineView
): boolean {
  const orderTw = normalizeSalesClientKhId(order.subiekt_tw_id);
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

/** Suma dostarczonych sztuk z prośb dopasowanych do pozycji ZK. */
export function totalDeliveredQtyForZkLineFromOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView
): number {
  let total = 0;
  for (const order of orders) {
    if (!isDeliveredOrderStatus(order.status)) continue;
    if (!productMatchesZkLine(order, line)) continue;
    const progress = getDeliveryProgress(order.quantity, order.delivered_quantity);
    total += progress.delivered;
  }
  return total;
}

/** Czy łączna dostawa prośb pokrywa wymaganą ilość pozycji ZK. */
export function isZkLineFullyDeliveredByOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView
): boolean {
  const matchingDelivered = orders.filter(
    (order) => isDeliveredOrderStatus(order.status) && productMatchesZkLine(order, line)
  );
  if (!matchingDelivered.length) return false;

  const required = line.quantity;
  if (required == null || required <= 0) {
    return matchingDelivered.some((order) => order.status === "Zrealizowane");
  }

  return totalDeliveredQtyForZkLineFromOrders(orders, line) >= required;
}

export function isOpenProsbaOrder(order: ZkLinkableOrder): boolean {
  if (order.sales_acknowledged_at) return false;
  if (!OPEN_PROSBA_STATUSES.has(order.status)) return false;
  if (order.sales_cancelled_at) {
    const active = activeOrderQuantity(order as import("@/types/database").IndividualOrder);
    if (active == null || active <= 0) return false;
    if (order.status === "Anulowane") return false;
    if (hasActiveSupplierFulfillment(order as import("@/types/database").IndividualOrder)) {
      return true;
    }
    return false;
  }
  return true;
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
  const relevant = orders.filter((o) => orderRelevantToZkWatch(o, watch));

  let matchingOpenRequestCount = 0;
  const matchingOpenRequestIds: string[] = [];
  const matchedDeliveredLineKeys = new Set<string>();

  for (const order of relevant) {
    const explicitZk = orderExplicitlyLinkedToZkWatch(order, watch);
    const matchedLines = lineViews.filter((line) => productMatchesZkLine(order, line));

    if (isOpenProsbaOrder(order)) {
      if (explicitZk || matchedLines.length) {
        matchingOpenRequestCount += 1;
        matchingOpenRequestIds.push(order.id);
      }
    }
    if (!matchedLines.length) continue;
    if (isDeliveredOrderStatus(order.status)) {
      for (const line of matchedLines) {
        if (isZkLineFullyDeliveredByOrders(relevant, line)) {
          matchedDeliveredLineKeys.add(line.key);
        }
      }
    }
  }

  const productLines = lineViews.filter((l) => l.key !== "summary");
  const allLinesMatchedByOrders =
    productLines.length > 0 &&
    productLines.every((line) => isZkLineFullyDeliveredByOrders(relevant, line));

  return {
    matchingOpenRequestCount,
    matchingOpenRequestIds,
    matchedDeliveredLineKeys: [...matchedDeliveredLineKeys],
    allLinesMatchedByOrders,
  };
}

/** Po dostawie / cofnięciu dostawy — przelicz pozycje ZK wg prośb. */
export function mergeZkLineChecksFromDeliveredOrders(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): { checks: ZkWatchLineCheckStored[]; changed: boolean } {
  const views = buildZkWatchLineViews(watch);
  const previous = parseZkWatchLineChecks(watch.line_checks);
  const arrived = arrivedByKeyFromChecks(previous);

  const relevantAll = orders.filter((order) => orderRelevantToZkWatch(order, watch));
  const relevantDelivered = relevantAll.filter((order) =>
    isDeliveredOrderStatus(order.status)
  );

  for (const line of views) {
    const hasLinkedProsba = relevantAll.some((order) => productMatchesZkLine(order, line));
    if (!hasLinkedProsba) continue;

    arrived.set(line.key, isZkLineFullyDeliveredByOrders(relevantDelivered, line));
  }

  const next = views.map((v) => ({
    key: v.key,
    arrived: arrived.get(v.key) ?? false,
  }));

  const changed = views.some((v) => {
    const wasArrived = previous.find((c) => c.key === v.key)?.arrived ?? false;
    const nowArrived = arrived.get(v.key) ?? false;
    return wasArrived !== nowArrived;
  });

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
