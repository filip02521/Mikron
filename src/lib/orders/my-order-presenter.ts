import { formatPlDate } from "@/lib/display-labels";
import {
  estimateDeliveryEta,
  formatActualDeliveryDays,
  isPastExpectedDate,
} from "@/lib/orders/delivery-eta";
import {
  enrichMyOrderSalesUi,
  salesTimingLabel,
  sortMyOrderRows,
  type MyOrderSalesUi,
} from "@/lib/orders/my-order-sales-ui";
import {
  getDeliveryProgress,
  isInformacjaRequest,
  type DeliveryProgress,
} from "@/lib/orders/individual";
import { isAwaitingSalesPickup } from "@/lib/orders/sales-pickup";
import {
  canEstimateDeliveryEta,
  orderPlacementAt,
  submittedAt,
} from "@/lib/orders/order-timing";
import type {
  DeliveryStats,
  IndividualOrder,
  IndividualOrderStatus,
  OrderType,
  StatsMode,
} from "@/types/database";
import { SUMMARY_COLORS } from "@/types/database";
import { groupOrdersForMyView, myOrderGroupKey } from "@/lib/orders/my-order-groups";
import { clientNamesSummary } from "@/lib/orders/sales-client-label";
import { describeVerificationGaps } from "@/lib/orders/verification-gaps";
import {
  canSalesCancelOrders,
  isSalesCancelNoticePending,
  resolveGroupSalesCancelPhase,
  resolveSalesCancelPhase,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import { canEditIndividualRequestGroup } from "@/lib/orders/individual-request-edit";

/** Stan pojedynczej pozycji względem magazynu (przy częściowej dostawie grupy). */
export type MyOrderLineStockStatus = "waiting" | "partial" | "on_stock" | "na";

export type MyOrderAcknowledgeMode =
  | "cancelled"
  | "cancel_notice"
  | "pickup"
  | "none";

export type MyOrderLine = {
  id: string;
  product: string;
  symbol: string | null;
  /** Surowa ilość z bazy (do edycji prośby). */
  quantity: string;
  quantityLabel: string;
  progressLabel: string | null;
  stockStatus: MyOrderLineStockStatus;
  /** Pozycja gotowa do potwierdzenia odbioru / powiadomienia. */
  canAcknowledgePickup: boolean;
  clientName: string | null;
};

type MyOrderRowCore = {
  id: string;
  kind: "zamowienie" | "informacja";
  /** Liczba produktów w grupie (1 = pojedyncza pozycja). */
  lineCount: number;
  lines: MyOrderLine[];
  submittedLabel: string;
  supplierName: string;
  /** Skrót przy grupie; szczegóły w lines. */
  product: string;
  symbol: string | null;
  quantityLabel: string;
  progressLabel: string | null;
  statusTitle: string;
  statusDetail: string | null;
  timingLabel: string | null;
  badgeVariant: "info" | "warning" | "success" | "default" | "purple" | "danger";
  rowColor: string;
};

export type MyOrderRow = MyOrderRowCore &
  Partial<MyOrderSalesUi> & {
    orderIds: string[];
    acknowledgeMode: MyOrderAcknowledgeMode;
    pickupPendingCount: number;
    pickupPendingIds: string[];
    pickupReadyTotal: number;
    pickupAcknowledgedCount: number;
    canCancelBySales: boolean;
    salesCancelPhase: SalesCancelPhase | null;
    /** Pozycje do wycofania (bez już wycofanych). */
    salesCancelOrderIds: string[];
    /** Pozycje z rezygnacją do potwierdzenia przeczytania. */
    cancelNoticeOrderIds: string[];
    /** Pozycje anulowane (before_order) do ukrycia. */
    cancelledAckOrderIds: string[];
    /** Skrót etykiet klientów na karcie (meta). */
    clientLabel: string | null;
    supplierId: string | null;
    salesPersonId: string;
    requestKind: "zamowienie" | "informacja";
    canEditBySales: boolean;
  };

type MyOrderRowDraft = MyOrderRowCore;

function deliveredQty(order: IndividualOrder): string {
  return order.delivered_quantity && order.delivered_quantity !== "-"
    ? order.delivered_quantity
    : "0";
}

export function lineStockStatus(order: IndividualOrder): MyOrderLineStockStatus {
  if (isInformacjaRequest(order)) {
    if (order.status === "Zrealizowane") return "on_stock";
    return "waiting";
  }

  const progress = getDeliveryProgress(order.quantity, deliveredQty(order));
  if (!progress.hasNumericQty) {
    return order.status === "Zrealizowane" ? "on_stock" : "na";
  }
  if (progress.delivered === 0) return "waiting";
  if (progress.ordered != null && progress.delivered >= progress.ordered) {
    return "on_stock";
  }
  return "partial";
}

function canAcknowledgePickupForOrder(order: IndividualOrder): boolean {
  return isAwaitingSalesPickup(order);
}

function resolveAcknowledgeMode(orders: IndividualOrder[]): MyOrderAcknowledgeMode {
  const open = orders.filter((o) => !o.sales_acknowledged_at);
  if (!open.length) return "none";
  if (open.every((o) => o.status === "Anulowane")) {
    return "cancelled";
  }
  if (open.some((o) => canAcknowledgePickupForOrder(o))) {
    return "pickup";
  }
  return "none";
}

function rowToLine(
  row: Pick<MyOrderRowDraft, "product" | "symbol" | "quantityLabel" | "progressLabel">,
  order: IndividualOrder
): MyOrderLine {
  return {
    id: order.id,
    product: row.product,
    symbol: row.symbol,
    quantity: order.quantity !== "-" ? order.quantity : "",
    quantityLabel: row.quantityLabel,
    progressLabel: row.progressLabel,
    stockStatus: lineStockStatus(order),
    canAcknowledgePickup: canAcknowledgePickupForOrder(order),
    clientName: order.sales_client_name?.trim() || null,
  };
}

function pickupMeta(orders: IndividualOrder[]) {
  const pending = orders.filter((o) => canAcknowledgePickupForOrder(o));
  const readyTotal = orders.filter((o) => o.status === "Zrealizowane").length;
  const acknowledged = orders.filter(
    (o) => o.status === "Zrealizowane" && Boolean(o.sales_acknowledged_at)
  ).length;
  return {
    pickupPendingCount: pending.length,
    pickupPendingIds: pending.map((o) => o.id),
    pickupReadyTotal: readyTotal,
    pickupAcknowledgedCount: acknowledged,
  };
}

function withAckMeta(
  row: MyOrderRowDraft,
  orders: IndividualOrder[],
  visibleOrders?: IndividualOrder[]
): MyOrderRow {
  const visible = visibleOrders ?? orders;
  const acknowledgeMode = resolveAcknowledgeMode(visible);
  const pickup = pickupMeta(orders);
  const editSource = visible.length ? visible : orders;
  const rep = editSource[0];
  return {
    ...row,
    orderIds: visible.map((o) => o.id),
    acknowledgeMode,
    canCancelBySales: canSalesCancelOrders(visible),
    canEditBySales: canEditIndividualRequestGroup(editSource),
    supplierId: rep?.supplier_id ?? null,
    salesPersonId: rep?.sales_person_id ?? "",
    requestKind: (rep?.request_kind ?? "zamowienie") as "zamowienie" | "informacja",
    salesCancelPhase: resolveGroupSalesCancelPhase(visible),
    salesCancelOrderIds: visible
      .filter((o) => !o.sales_cancelled_at && resolveSalesCancelPhase(o) !== null)
      .map((o) => o.id),
    cancelNoticeOrderIds: visible
      .filter(isSalesCancelNoticePending)
      .map((o) => o.id),
    cancelledAckOrderIds: visible
      .filter((o) => o.status === "Anulowane")
      .map((o) => o.id),
    clientLabel: clientNamesSummary(visible),
    ...pickup,
  };
}

function aggregateProgressLabel(orders: IndividualOrder[]): string | null {
  let ordered = 0;
  let delivered = 0;
  let numericLines = 0;

  for (const order of orders) {
    const progress = getDeliveryProgress(
      order.quantity,
      order.delivered_quantity && order.delivered_quantity !== "-"
        ? order.delivered_quantity
        : "0"
    );
    if (!progress.hasNumericQty || progress.ordered == null) continue;
    numericLines++;
    ordered += progress.ordered;
    delivered += progress.delivered;
  }

  if (numericLines === 0) return null;
  if (numericLines === 1) {
    return salesProgressLabel(orders[0].status, getDeliveryProgress(
      orders[0].quantity,
      orders[0].delivered_quantity && orders[0].delivered_quantity !== "-"
        ? orders[0].delivered_quantity
        : "0"
    ));
  }

  const status = orders[0].status;
  if (status === "Zrealizowane" && delivered >= ordered) {
    return numericLines > 1
      ? `Wszystkie ${ordered} szt. (${numericLines} prod.)`
      : `Wszystkie ${ordered} szt. na magazynie`;
  }
  return numericLines > 1
    ? `${delivered}/${ordered} szt. · ${numericLines} prod.`
    : `${delivered} z ${ordered} szt. na magazynie`;
}

function groupProductSummary(lines: MyOrderLine[]): string {
  if (lines.length === 1) return lines[0].product;
  const n = lines.length;
  const word = n === 1 ? "produkt" : n < 5 ? "produkty" : "produktów";
  return `${n} ${word} — jedna dostawa u dostawcy`;
}

function appendGroupDetail(detail: string | null, lineCount: number): string | null {
  if (lineCount <= 1) return detail;
  if (lineCount > 1 && detail && !detail.includes("wspólny termin")) {
    return `${detail} Wspólny termin dla wszystkich pozycji.`;
  }
  return detail;
}

function pickRepresentativeOrder(orders: IndividualOrder[]): IndividualOrder {
  const priority: IndividualOrderStatus[] = [
    "Czesciowo_zrealizowane",
    "Zamowione",
    "Nowe",
    "Weryfikacja",
    "Zrealizowane",
    "Anulowane",
  ];
  for (const status of priority) {
    const found = orders.find((o) => o.status === status);
    if (found) return found;
  }
  return orders[0];
}

/** Jak dział dostaw złożył zamówienie u dostawcy — w języku dla handlowca. */
function orderTypeHintForSales(orderType: OrderType): string | null {
  if (orderType === "Glowne") {
    return "W planowej dostawie do tego dostawcy (wspólne zamówienie z innymi towarami)";
  }
  if (orderType === "Poboczne") {
    return "Osobne domówienie tylko na Twoją prośbę — poza planową dostawą";
  }
  return null;
}

/** Ile sztuk jest już na magazynie względem zamówionej ilości. */
function salesProgressLabel(
  status: IndividualOrderStatus,
  progress: DeliveryProgress
): string | null {
  if (!progress.hasNumericQty || progress.ordered == null) {
    return null;
  }
  const q = progress.ordered;
  const d = progress.delivered;

  if (status === "Nowe" || status === "Weryfikacja") {
    return `Zamówiono ${q} szt.`;
  }
  if (status === "Zamowione" && d === 0) {
    return `0 z ${q} szt.`;
  }
  if (status === "Czesciowo_zrealizowane") {
    return `${d} z ${q} szt.`;
  }
  if (status === "Zrealizowane") {
    return `wszystkie ${q} szt.`;
  }
  if (d > 0) {
    return `${d} z ${q} szt.`;
  }
  return `0 z ${q} szt.`;
}

function presentInformacja(order: IndividualOrder): MyOrderRow {
  const base = {
    id: order.id,
    lineCount: 1,
    lines: [] as MyOrderLine[],
    kind: "informacja" as const,
    submittedLabel: formatPlDate(submittedAt(order).slice(0, 10)),
    supplierName: order.supplier?.name ?? "—",
    product: order.products,
    symbol: order.symbol && order.symbol !== "-" ? order.symbol : null,
    quantityLabel: "—",
    progressLabel: null,
    rowColor: SUMMARY_COLORS.informacja,
  };

  const finalize = (row: MyOrderRowDraft): MyOrderRow =>
    withAckMeta(
      {
        ...row,
        lines: [rowToLine(row, order)],
        lineCount: 1,
      },
      [order]
    );

  switch (order.status) {
    case "Weryfikacja":
      return finalize({
        ...base,
        supplierName: order.supplier?.name ?? "Do ustalenia",
        statusTitle: "Uzupełnianie danych",
        statusDetail: describeVerificationGaps(order),
        timingLabel: null,
        badgeVariant: "warning",
        rowColor: SUMMARY_COLORS.historyVerification,
      });
    case "Nowe":
      return finalize({
        ...base,
        statusTitle: "Oczekuje na dostawę",
        statusDetail:
          "Nie składamy zamówienia u dostawcy. Wyślemy e-mail, gdy towar pojawi się na magazynie.",
        timingLabel: null,
        badgeVariant: "purple",
      });
    case "Zrealizowane":
      return finalize({
        ...base,
        statusTitle: "Dostępne",
        statusDetail:
          "Towar jest na magazynie. Potwierdź, że widziałeś/aś powiadomienie — wpis zniknie z listy.",
        timingLabel: order.delivery_at
          ? `E-mail ${formatPlDate(order.delivery_at.slice(0, 10))}`
          : null,
        badgeVariant: "success",
      });
    case "Anulowane":
      return finalize({
        ...base,
        statusTitle: "Anulowano",
        statusDetail: "Prośba została wycofana. Potwierdź, aby ukryć ją z listy.",
        timingLabel: null,
        badgeVariant: "default",
        rowColor: SUMMARY_COLORS.historyCancelled,
      });
    default:
      return finalize({
        ...base,
        statusTitle: order.status,
        statusDetail: null,
        timingLabel: null,
        badgeVariant: "info",
      });
  }
}

function presentZamowienie(
  order: IndividualOrder,
  stats: DeliveryStats | undefined
): MyOrderRow {
  const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
  const progress = getDeliveryProgress(
    order.quantity,
    order.delivered_quantity && order.delivered_quantity !== "-"
      ? order.delivered_quantity
      : "0"
  );

  const base = {
    id: order.id,
    lineCount: 1,
    lines: [] as MyOrderLine[],
    kind: "zamowienie" as const,
    submittedLabel: formatPlDate(submittedAt(order).slice(0, 10)),
    supplierName: order.supplier?.name ?? "—",
    product: order.products,
    symbol: order.symbol && order.symbol !== "-" ? order.symbol : null,
    quantityLabel: progress.hasNumericQty ? `${order.quantity} szt.` : order.quantity,
    progressLabel:
      salesProgressLabel(order.status, progress) ??
      (order.delivered_quantity && order.delivered_quantity !== "-"
        ? order.delivered_quantity
        : progress.hasNumericQty
          ? `${order.quantity} szt. zamówione`
          : null),
    rowColor: SUMMARY_COLORS.historyNew,
  };

  const finalize = (row: MyOrderRowDraft): MyOrderRow =>
    withAckMeta(
      {
        ...row,
        lines: [rowToLine(row, order)],
        lineCount: 1,
      },
      [order]
    );

  const placement = orderPlacementAt(order);
  const eta = canEstimateDeliveryEta(order)
    ? placement
      ? estimateDeliveryEta(placement, stats, order.order_type, statsMode)
      : null
    : null;

  let timingLabel: string | null = null;
  if (order.status === "Zrealizowane" && order.delivery_at && placement) {
    const actual = formatActualDeliveryDays(placement, order.delivery_at);
    timingLabel = actual ? `Dostawa trwała: ${actual}` : null;
  } else if (eta) {
    timingLabel = salesTimingLabel(
      eta.expectedDate,
      eta.avgBusinessDays,
      eta.lowConfidence
    );
  }

  switch (order.status) {
    case "Weryfikacja":
      return finalize({
        ...base,
        supplierName: order.supplier?.name ?? "Do ustalenia",
        statusTitle: "Uzupełnianie danych",
        statusDetail: describeVerificationGaps(order),
        timingLabel: null,
        badgeVariant: "warning",
        rowColor: SUMMARY_COLORS.historyVerification,
      });
    case "Nowe":
      return finalize({
        ...base,
        statusTitle: "Przed zamówieniem",
        statusDetail:
          "Prośba jest u działu dostaw. Złożymy zamówienie planowo (z innymi towarami) lub osobno — szacowany termin pojawi się po zamówieniu.",
        timingLabel: null,
        badgeVariant: "purple",
        rowColor: SUMMARY_COLORS.historyNew,
      });
    case "Zamowione":
      return finalize({
        ...base,
        statusTitle: "Zamówione",
        statusDetail: [
          orderTypeHintForSales(order.order_type),
          placement
            ? `Zamówiono ${formatPlDate(placement.slice(0, 10))} — od tej daty liczymy szacowany termin`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        timingLabel,
        badgeVariant:
          eta && isPastExpectedDate(eta.expectedDate) ? "danger" : "info",
        rowColor: SUMMARY_COLORS.historyPending,
      });
    case "Czesciowo_zrealizowane":
      return finalize({
        ...base,
        statusTitle: "Częściowo na magazynie",
        statusDetail:
          progress.remaining != null && progress.remaining > 0
            ? `Część sztuk jest już u nas — możesz odebrać. U dostawcy brakuje jeszcze ${progress.remaining} szt.`
            : "Część towaru jest do odbioru, reszta czeka u dostawcy.",
        timingLabel,
        badgeVariant: "warning",
        rowColor: SUMMARY_COLORS.historyPartial,
      });
    case "Zrealizowane":
      return finalize({
        ...base,
        statusTitle: "Do odbioru",
        statusDetail: [
          orderTypeHintForSales(order.order_type),
          "Całość jest na magazynie. Potwierdź odbiór — wtedy wpis zniknie z listy.",
        ]
          .filter(Boolean)
          .join(" · "),
        timingLabel,
        badgeVariant: "success",
        rowColor: SUMMARY_COLORS.historyCompleted,
      });
    case "Anulowane":
      return finalize({
        ...base,
        statusTitle: "Anulowane",
        statusDetail: "Zgłoszenie wycofane. Potwierdź, aby ukryć je z listy.",
        timingLabel: null,
        badgeVariant: "default",
        rowColor: SUMMARY_COLORS.historyCancelled,
      });
    default:
      return finalize({
        ...base,
        statusTitle: order.status,
        statusDetail: null,
        timingLabel,
        badgeVariant: "info",
      });
  }
}

export function presentMyOrderGroup(
  orders: IndividualOrder[],
  statsBySupplier: Record<string, DeliveryStats>
): MyOrderRow {
  const visibleOrders = orders.filter((o) => !o.sales_acknowledged_at);

  if (orders.length === 1) {
    const row = presentMyOrder(orders[0], statsBySupplier);
    return withAckMeta(row, orders, visibleOrders);
  }

  const representative = pickRepresentativeOrder(visibleOrders.length ? visibleOrders : orders);
  const base = presentMyOrder(representative, statsBySupplier);
  const lines = visibleOrders.map((o) => {
    const row = presentMyOrder(o, statsBySupplier);
    return rowToLine(row, o);
  });

  return withAckMeta(
    {
      ...base,
      id: myOrderGroupKey(representative),
      lineCount: lines.length,
      lines,
      product: groupProductSummary(lines),
      symbol: null,
      progressLabel:
        aggregateProgressLabel(visibleOrders.length ? visibleOrders : orders) ??
        base.progressLabel,
      statusDetail: appendGroupDetail(base.statusDetail, lines.length),
      submittedLabel: formatPlDate(
        orders
          .map((o) => submittedAt(o))
          .sort()
          .reverse()[0]
          .slice(0, 10)
      ),
    },
    orders,
    visibleOrders
  );
}

export function presentMyOrder(
  order: IndividualOrder,
  statsBySupplier: Record<string, DeliveryStats>
): MyOrderRow {
  if (isInformacjaRequest(order)) {
    return presentInformacja(order);
  }
  const stats = order.supplier_id
    ? statsBySupplier[order.supplier_id]
    : undefined;
  return presentZamowienie(order, stats);
}

export function presentMyOrders(
  orders: IndividualOrder[],
  statsRows: DeliveryStats[]
): {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
} {
  const statsBySupplier = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  const zamowienia: MyOrderRow[] = [];
  const informacje: MyOrderRow[] = [];

  const zamowienieOrders = orders.filter((o) => !isInformacjaRequest(o));
  const informacjaOrders = orders.filter((o) => isInformacjaRequest(o));

  for (const group of groupOrdersForMyView(zamowienieOrders)) {
    const open = group.filter((o) => !o.sales_acknowledged_at);
    if (!open.length) continue;
    if (open.every((o) => o.status === "Anulowane")) continue;
    zamowienia.push(presentMyOrderGroup(group, statsBySupplier));
  }
  for (const group of groupOrdersForMyView(informacjaOrders)) {
    const open = group.filter((o) => !o.sales_acknowledged_at);
    if (!open.length) continue;
    if (open.every((o) => o.status === "Anulowane")) continue;
    informacje.push(presentMyOrderGroup(group, statsBySupplier));
  }

  const productLineCount = zamowienia.reduce((n, r) => n + r.lineCount, 0)
    + informacje.reduce((n, r) => n + r.lineCount, 0);

  const attachSalesUi = (row: MyOrderRow): MyOrderRow => ({
    ...row,
    ...enrichMyOrderSalesUi(row),
  });

  return {
    zamowienia: sortMyOrderRows(zamowienia.map(attachSalesUi)),
    informacje: sortMyOrderRows(informacje.map(attachSalesUi)),
    productLineCount,
  };
}
