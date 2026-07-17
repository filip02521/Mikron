import {
  buildZkWatchLineViews,
  checksFromLineViews,
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import { getZkWatchProsbaScopeLineKeys } from "@/lib/sales/zk-watch-prosba-scope";
import { normalizeMyOrderSearchText } from "@/lib/orders/my-order-search";
import {
  clientsMatchForSalesClient,
  normalizeSalesClientKhId,
} from "@/lib/orders/sales-client-match";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import { isZkWatchArchived } from "@/lib/data/sales-notepad";
import { getDeliveryProgress, INFORMACJA_NO_QUANTITY, parseOrderQuantity } from "@/lib/orders/individual";
import {
  activeOrderQuantity,
  hasActiveSupplierFulfillment,
} from "@/lib/orders/sales-cancel";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
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
  request_kind?: IndividualRequestKind | null;
  ordered_at: string | null;
  action_at: string | null;
  delivery_at: string | null;
  zd_fulfillment_deadline: string | null;
  zd_fulfillment_previous_deadline?: string | null;
  zd_fulfillment_deadline_changed_at?: string | null;
  zd_fulfillment_deadline_change_seen_at?: string | null;
  is_teeth: boolean | null;
  informacja_stock_out_reorder?: boolean | null;
  sales_acknowledged_at: string | null;
  sales_cancelled_at: string | null;
};

export type ZkTeethOrder = ZkLinkableOrder & {
  teeth_ordered_at: string | null;
  teeth_delivery_date: string | null;
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

export type ZkWatchLineCoverage = "uncovered" | "open" | "partial" | "delivered";

/** Odbiór z regału potwierdzony w Moje zamówienia (sales_acknowledged_at). */
export function isZkLinePickedFromShelf(
  line: ZkWatchLineView,
  coverage: ZkWatchLineCoverage | undefined,
  relevantOrders: ZkLinkableOrder[]
): boolean {
  if (coverage !== "delivered" && coverage !== "partial") return false;
  const matching = relevantOrders.filter(
    (order) => isPhysicalDeliveryOrder(order) && productMatchesZkLine(order, line)
  );
  if (!matching.length) return false;
  return matching.every((order) => Boolean(order.sales_acknowledged_at));
}

/** Towar z prośby dotarł i czeka na odbiór z regału (bez potwierdzenia w Moje). */
export function isZkLineWaitingOnShelf(
  line: ZkWatchLineView,
  coverage: ZkWatchLineCoverage | undefined,
  relevantOrders: ZkLinkableOrder[]
): boolean {
  if (coverage !== "delivered") return false;
  return !isZkLinePickedFromShelf(line, coverage, relevantOrders);
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
  /** Pokrycie każdej pozycji ZK przez prośby. */
  lineCoverageByKey: Record<string, ZkWatchLineCoverage>;
  /** Pozycje bez żadnej powiązanej prośby. */
  uncoveredLineKeys: string[];
  /** Pozycje objęte otwartą prośbą. */
  openProsbaCoveredLineKeys: string[];
  /** Czy handlowiec ustalił zakres pozycji do prośby. */
  prosbaScopeConfigured: boolean;
  /** Pozycje odebrane z regału (potwierdzenie odbioru w Moje zamówienia). */
  inStockLineKeys: string[];
  /** Pozycje czekające na regale — dostawa z prośby bez odbioru w Moje. */
  regalWaitingLineKeys: string[];
  /** Pozycje z potwierdzoną dostępnością (prośba informacyjna, bez „Na regale”). */
  informacjaReadyLineKeys: string[];
  /** Pozycje z potwierdzonym odczytem informacji w Moje zamówienia. */
  informacjaAcknowledgedLineKeys: string[];
  /** Pozycje pominięte przy wyborze zakresu prośby (needs_prosba: false). */
  scopeExcludedLineKeys: string[];
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
  if (sym && lineSym && sym === lineSym) {
    return true;
  }

  const orderMikran = normalizeProductToken(order.mikran_code);
  if (orderMikran && lineSym && orderMikran === lineSym) {
    return true;
  }

  const orderName = normalizeProductToken(order.products);
  const lineName = normalizeProductToken(line.product);
  if (!orderName || !lineName) return false;
  return orderName === lineName;
}

/** Luźniejsze dopasowanie tylko dla otwartych prośb jawnie powiązanych z tym ZK (legacy / ręczne opisy). */
export function productMatchesZkLineForCoverage(
  order: ZkLinkableOrder,
  line: ZkWatchLineView,
  watch: Pick<SalesZkWatch, "id" | "zk_number">
): boolean {
  if (productMatchesZkLine(order, line)) return true;
  if (!orderExplicitlyLinkedToZkWatch(order, watch) || !isOpenProsbaOrder(order)) {
    return false;
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

/** Fizyczna dostawa zamówienia — bez sygnału informacyjnego z magazynu. */
export function isPhysicalDeliveryOrder(
  order: Pick<ZkLinkableOrder, "request_kind" | "status" | "quantity">
): boolean {
  if (isInformacjaWarehouseReadyOrder(order)) return false;
  return isDeliveredOrderStatus(order.status);
}

/** Magazyn potwierdził dostępność towaru (prośba informacyjna, bez ilości). */
export function isInformacjaWarehouseReadyOrder(
  order: Pick<ZkLinkableOrder, "request_kind" | "status" | "quantity">
): boolean {
  if (order.status !== "Zrealizowane") return false;
  if (order.request_kind === "informacja") return true;
  const qty = order.quantity?.trim();
  if (!order.request_kind && (!qty || qty === INFORMACJA_NO_QUANTITY)) return true;
  return false;
}

/** Suma dostarczonych sztuk z prośb dopasowanych do pozycji ZK. */
export function totalDeliveredQtyForZkLineFromOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView
): number {
  let total = 0;
  for (const order of orders) {
    if (!isPhysicalDeliveryOrder(order)) continue;
    if (!productMatchesZkLine(order, line)) continue;
    const progress = getDeliveryProgress(order.quantity, order.delivered_quantity);
    total += progress.delivered;
  }
  return total;
}

function isLineCoveredByStockScopeOnly(
  line: ZkWatchLineView,
  watch: Pick<SalesZkWatch, "line_checks">
): boolean {
  const checks = parseZkWatchLineChecks(watch.line_checks);
  const entry = checks.find((check) => check.key === line.key);
  return entry?.needs_prosba === false;
}

function activeOrderedQtyForZkLink(order: ZkLinkableOrder): number {
  const parsed = parseOrderQuantity(order.quantity);
  if (parsed == null || parsed <= 0) return 0;
  if (order.sales_cancelled_at) {
    const active = activeOrderQuantity(order as IndividualOrder);
    return active ?? 0;
  }
  return parsed;
}

/** Suma quantity z prośb dopasowanych do pozycji ZK (w tym zrealizowane — do limitu coverage). */
export function totalOrderedQtyForZkLineFromOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView
): number {
  let total = 0;
  for (const order of orders) {
    if (!productMatchesZkLine(order, line)) continue;
    if (order.request_kind === "informacja") continue;
    const qty = activeOrderedQtyForZkLink(order);
    if (qty <= 0) continue;
    total += qty;
  }
  return total;
}

/** Suma quantity z aktywnych (otwartych) prośb — do etykiety „w prośbie X szt.” na liście towaru. */
export function totalOpenOrderedQtyForZkLineFromOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView
): number {
  let total = 0;
  for (const order of orders) {
    if (!productMatchesZkLine(order, line)) continue;
    if (order.request_kind === "informacja") continue;
    if (!isOpenProsbaOrder(order)) continue;
    const qty = activeOrderedQtyForZkLink(order);
    if (qty <= 0) continue;
    total += qty;
  }
  return total;
}

export type ZkLineProsbaQuantityMeta = {
  /** Etykieta pod nazwą produktu na liście towaru ZK. */
  displayLabel: string;
  title: string;
};

/**
 * Gdy ilość w prośbie < ilość ZK — doprecyzuj przy liście towaru,
 * żeby magazyn nie szukał pełnej ilości ZK na regale.
 */
export function buildZkLineProsbaQuantityMeta(
  line: ZkWatchLineView,
  orders: ZkLinkableOrder[],
  watch: Pick<
    SalesZkWatch,
    "line_checks" | "id" | "zk_number" | "sales_person_id" | "client_kh_id" | "client_label"
  >
): ZkLineProsbaQuantityMeta | null {
  const zkQty = line.quantity;
  const zkLabel = line.quantityLabel;
  if (!zkLabel) return null;

  const relevant = orders.filter((order) => isOrderRelevantToZkWatch(order, watch as SalesZkWatch));
  const orderedQty = totalOpenOrderedQtyForZkLineFromOrders(relevant, line);
  const fromStockScope = isLineCoveredByStockScopeOnly(line, watch);

  if (orderedQty > 0 && zkQty != null && orderedQty < zkQty) {
    const stockGap = zkQty - orderedQty;
    return {
      displayLabel: `${zkLabel} · w prośbie ${orderedQty} szt. · ${stockGap} szt. ze stanu`,
      title:
        `W ZK jest ${zkQty} szt., w prośbie zamówiono ${orderedQty} szt.` +
        ` Pozostałe ${stockGap} szt. powinny być już na stanie magazynowym.` +
        " Przy odbiorze z regału licz się na ilość z prośby, nie na pełną ilość ZK.",
    };
  }

  if (fromStockScope && orderedQty === 0 && zkQty != null) {
    return {
      displayLabel: `${zkLabel} · ze stanu magazynowego`,
      title: `W ZK jest ${zkQty} szt. — pozycja oznaczona jako dostępna na stanie, bez prośby o zamówienie.`,
    };
  }

  return null;
}

/**
 * Ile sztuk trzeba domknąć prośbami — suma quantity powiązanych prośb,
 * albo pełna ilość ZK gdy brak prośby. Pozycja „na stanie” (needs_prosba: false) → 0.
 */
export function effectiveRequiredQtyForZkLine(
  line: ZkWatchLineView,
  orders: ZkLinkableOrder[],
  watch: Pick<SalesZkWatch, "line_checks">
): number | null {
  if (isLineCoveredByStockScopeOnly(line, watch)) return 0;
  const orderedTotal = totalOrderedQtyForZkLineFromOrders(orders, line);
  if (orderedTotal > 0) {
    const zkQty = line.quantity;
    if (zkQty != null && zkQty > 0) {
      return Math.min(orderedTotal, zkQty);
    }
    return orderedTotal;
  }
  const zkQty = line.quantity;
  return zkQty != null && zkQty > 0 ? zkQty : null;
}

/** Pozycja oznaczona „na stanie” bez aktywnej prośby — domknięta bez zamówienia. */
function isLineFulfilledFromStockScopeOnly(
  line: ZkWatchLineView,
  orders: ZkLinkableOrder[],
  watch: Pick<SalesZkWatch, "line_checks">
): boolean {
  if (!isLineCoveredByStockScopeOnly(line, watch)) return false;
  return !orders.some(
    (order) =>
      productMatchesZkLine(order, line) &&
      (isOpenProsbaOrder(order) ||
        isInformacjaWarehouseReadyOrder(order) ||
        isPhysicalDeliveryOrder(order))
  );
}

/** Czy łączna dostawa prośb pokrywa wymaganą ilość pozycji ZK. */
export function isZkLineFullyDeliveredByOrders(
  orders: ZkLinkableOrder[],
  line: ZkWatchLineView,
  watch?: Pick<SalesZkWatch, "line_checks">
): boolean {
  if (watch && isLineFulfilledFromStockScopeOnly(line, orders, watch)) {
    return true;
  }

  const matchingDelivered = orders.filter(
    (order) => isPhysicalDeliveryOrder(order) && productMatchesZkLine(order, line)
  );

  if (!matchingDelivered.length) return false;

  const required = watch
    ? effectiveRequiredQtyForZkLine(line, orders, watch)
    : line.quantity;

  if (required == null || required <= 0) {
    return matchingDelivered.some((order) => order.status === "Zrealizowane");
  }

  return totalDeliveredQtyForZkLineFromOrders(orders, line) >= required;
}

/** Magazyn potwierdził dostępność — informacja czeka na odczyt w Moje. */
export function isZkLineInformacjaReady(
  line: ZkWatchLineView,
  relevantOrders: ZkLinkableOrder[]
): boolean {
  return relevantOrders.some(
    (order) =>
      isInformacjaWarehouseReadyOrder(order) &&
      productMatchesZkLine(order, line) &&
      !order.sales_acknowledged_at
  );
}

/** Handlowiec potwierdził powiadomienie informacyjne w Moje. */
export function isZkLineInformacjaAcknowledged(
  line: ZkWatchLineView,
  relevantOrders: ZkLinkableOrder[]
): boolean {
  return relevantOrders.some(
    (order) =>
      isInformacjaWarehouseReadyOrder(order) &&
      productMatchesZkLine(order, line) &&
      Boolean(order.sales_acknowledged_at)
  );
}

/** Częściowa dostawa u dostawcy — prośba nadal aktywna mimo odbioru części z regału. */
function isPartialProsbaStillActive(order: ZkLinkableOrder): boolean {
  return (
    order.status === "Czesciowo_zrealizowane" &&
    hasActiveSupplierFulfillment(order as IndividualOrder)
  );
}

export function isOpenProsbaOrder(order: ZkLinkableOrder): boolean {
  if (order.sales_acknowledged_at) {
    if (isPartialProsbaStillActive(order)) return true;
    return false;
  }
  if (!OPEN_PROSBA_STATUSES.has(order.status)) return false;
  if (order.sales_cancelled_at) {
    const active = activeOrderQuantity(order as IndividualOrder);
    if (active == null || active <= 0) return false;
    if (order.status === "Anulowane") return false;
    if (hasActiveSupplierFulfillment(order as IndividualOrder)) {
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
    const products = normalizeMyOrderSearchText(w.line_summary ?? "");
    return label.includes(q) || zk.includes(q) || products.includes(q);
  });
}

export function computeZkWatchLineCoverage(
  line: ZkWatchLineView,
  relevantOrders: ZkLinkableOrder[],
  watch: Pick<SalesZkWatch, "id" | "zk_number" | "line_checks">
): ZkWatchLineCoverage {
  const matching = relevantOrders.filter((order) =>
    productMatchesZkLineForCoverage(order, line, watch)
  );
  if (!matching.length) return "uncovered";
  if (matching.some((order) => isOpenProsbaOrder(order))) return "open";
  if (isZkLineFullyDeliveredByOrders(relevantOrders, line, watch)) return "delivered";
  if (matching.some((order) => isPhysicalDeliveryOrder(order))) return "partial";
  return "uncovered";
}

export function collectPartialLineKeysFromCoverage(
  lineCoverageByKey: Record<string, ZkWatchLineCoverage> | undefined
): string[] {
  if (!lineCoverageByKey) return [];
  return Object.entries(lineCoverageByKey)
    .filter(([, coverage]) => coverage === "partial")
    .map(([key]) => key);
}

export function resolveUncoveredLineKeysForProsba(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[],
  options?: { onlyKeys?: string[] }
): string[] {
  const hints = computeZkWatchOrderHints(watch, orders);
  let keys = hints.uncoveredLineKeys;
  if (options?.onlyKeys?.length) {
    const only = new Set(options.onlyKeys);
    keys = keys.filter((key) => only.has(key));
  }
  return keys;
}

/** Indeks prośb po handlowcu — mniejszy podzbiór przy liczeniu hintów per ZK. */
export function indexZkLinkableOrdersBySalesPerson(
  orders: ZkLinkableOrder[]
): Map<string, ZkLinkableOrder[]> {
  const map = new Map<string, ZkLinkableOrder[]>();
  for (const order of orders) {
    const bucket = map.get(order.sales_person_id);
    if (bucket) bucket.push(order);
    else map.set(order.sales_person_id, [order]);
  }
  return map;
}

/** Hinty dla wszystkich ZK — ten sam wynik co pętla z pełną listą prośb, mniej pracy CPU. */
export function computeAllZkWatchOrderHints(
  watches: SalesZkWatch[],
  orders: ZkLinkableOrder[]
): Map<string, ZkWatchOrderHints> {
  const bySalesPerson = indexZkLinkableOrdersBySalesPerson(orders);
  const map = new Map<string, ZkWatchOrderHints>();
  for (const watch of watches) {
    map.set(
      watch.id,
      computeZkWatchOrderHints(watch, bySalesPerson.get(watch.sales_person_id) ?? [])
    );
  }
  return map;
}

export function zkWatchOrderHintsForWatch(
  watch: SalesZkWatch,
  ordersBySalesPerson: Map<string, ZkLinkableOrder[]>
): ZkWatchOrderHints {
  return computeZkWatchOrderHints(
    watch,
    ordersBySalesPerson.get(watch.sales_person_id) ?? []
  );
}

export function computeZkWatchOrderHints(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): ZkWatchOrderHints {
  const lineViews = buildZkWatchLineViews(watch);
  const relevant = orders.filter((o) => orderRelevantToZkWatch(o, watch));
  const prosbaScopeKeys = getZkWatchProsbaScopeLineKeys(watch, lineViews);
  const prosbaScopeConfigured = prosbaScopeKeys !== null;
  const prosbaScopeSet = prosbaScopeKeys ? new Set(prosbaScopeKeys) : null;
  const checks = parseZkWatchLineChecks(watch.line_checks);
  const needsByKey = new Map(
    checks
      .filter((check) => check.needs_prosba !== undefined)
      .map((check) => [check.key, check.needs_prosba === true])
  );
  const inStockLineKeys: string[] = [];
  const regalWaitingLineKeys: string[] = [];
  const informacjaReadyLineKeys: string[] = [];
  const informacjaAcknowledgedLineKeys: string[] = [];
  const scopeExcludedLineKeys: string[] = [];

  let matchingOpenRequestCount = 0;
  const matchingOpenRequestIds: string[] = [];
  const matchedDeliveredLineKeys = new Set<string>();
  const lineCoverageByKey: Record<string, ZkWatchLineCoverage> = {};
  const uncoveredLineKeys: string[] = [];
  const openProsbaCoveredLineKeys: string[] = [];

  for (const line of lineViews) {
    if (line.key === "summary") continue;

    const scopeExcluded =
      prosbaScopeSet != null &&
      (!prosbaScopeSet.has(line.key) || needsByKey.get(line.key) === false);
    if (scopeExcluded) {
      scopeExcludedLineKeys.push(line.key);
    }

    const coverage = computeZkWatchLineCoverage(line, relevant, watch);
    lineCoverageByKey[line.key] = coverage;

    if (isZkLinePickedFromShelf(line, coverage, relevant)) {
      inStockLineKeys.push(line.key);
    }
    if (isZkLineWaitingOnShelf(line, coverage, relevant)) {
      regalWaitingLineKeys.push(line.key);
    }
    if (isZkLineInformacjaReady(line, relevant)) {
      informacjaReadyLineKeys.push(line.key);
    }
    if (isZkLineInformacjaAcknowledged(line, relevant)) {
      informacjaAcknowledgedLineKeys.push(line.key);
    }

    if (scopeExcluded) continue;

    if (coverage === "uncovered") {
      if (
        isZkLineInformacjaReady(line, relevant) ||
        isZkLineInformacjaAcknowledged(line, relevant)
      ) {
        continue;
      }
      uncoveredLineKeys.push(line.key);
    }
    if (coverage === "open") openProsbaCoveredLineKeys.push(line.key);
  }

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
    if (isPhysicalDeliveryOrder(order)) {
      for (const line of matchedLines) {
        if (isZkLineFullyDeliveredByOrders(relevant, line, watch)) {
          matchedDeliveredLineKeys.add(line.key);
        }
      }
    }
  }

  const productLines = lineViews.filter((l) => l.key !== "summary");
  const allLinesMatchedByOrders =
    productLines.length > 0 &&
    productLines.every((line) => isZkLineFullyDeliveredByOrders(relevant, line, watch));

  return {
    matchingOpenRequestCount,
    matchingOpenRequestIds,
    matchedDeliveredLineKeys: [...matchedDeliveredLineKeys],
    allLinesMatchedByOrders,
    lineCoverageByKey,
    uncoveredLineKeys,
    openProsbaCoveredLineKeys,
    prosbaScopeConfigured,
    inStockLineKeys,
    regalWaitingLineKeys,
    informacjaReadyLineKeys,
    informacjaAcknowledgedLineKeys,
    scopeExcludedLineKeys,
  };
}

/** Po dostawie / odbiorze — czyści legacy arrived bez ręcznego zakończenia. */
export function mergeZkLineChecksFromDeliveredOrders(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): { checks: ZkWatchLineCheckStored[]; changed: boolean } {
  const views = buildZkWatchLineViews(watch);
  const relevant = orders.filter((o) => orderRelevantToZkWatch(o, watch));
  const hints = computeZkWatchOrderHints(watch, orders);
  const inStockSet = new Set(hints.inStockLineKeys);
  const previous = parseZkWatchLineChecks(watch.line_checks);

  const next = views.map((v) => {
    const prev = previous.find((c) => c.key === v.key);
    let arrived = prev?.arrived ?? false;
    const completedManually = prev?.completed_manually ?? false;

    if (inStockSet.has(v.key) && arrived && !completedManually) {
      arrived = false;
    } else if (arrived && !completedManually) {
      const coverage = computeZkWatchLineCoverage(v, relevant, watch);
      if (!inStockSet.has(v.key)) {
        arrived = false;
      }
    }

    const coverage = computeZkWatchLineCoverage(v, relevant, watch);
    const waitingOnShelf = isZkLineWaitingOnShelf(v, coverage, relevant);
    const pickedFromShelf = inStockSet.has(v.key);
    const informacjaReady = isZkLineInformacjaReady(v, relevant);
    const informacjaAcked = isZkLineInformacjaAcknowledged(v, relevant);
    let shelfMarked = prev?.shelf_marked ?? false;
    if (waitingOnShelf || pickedFromShelf || informacjaReady || informacjaAcked) {
      shelfMarked = true;
    } else if (!completedManually) {
      shelfMarked = false;
    }

    return {
      key: v.key,
      arrived,
      ...(completedManually ? { completed_manually: true } : {}),
      ...(shelfMarked ? { shelf_marked: true } : {}),
      ...(prev?.needs_prosba !== undefined ? { needs_prosba: prev.needs_prosba } : {}),
    };
  });

  const changed =
    next.length !== previous.length ||
    next.some((check) => {
      const prev = previous.find((c) => c.key === check.key);
      return (
        !prev ||
        prev.arrived !== check.arrived ||
        Boolean(prev.shelf_marked) !== Boolean(check.shelf_marked) ||
        Boolean(prev.completed_manually) !== Boolean(check.completed_manually) ||
        (prev.needs_prosba ?? undefined) !== (check.needs_prosba ?? undefined)
      );
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
