import { formatPlDate } from "@/lib/display-labels";
import {
  estimateDeliveryEta,
  isPastExpectedDate,
} from "@/lib/orders/delivery-eta";
import {
  enrichMyOrderSalesUi,
  aggregateGroupZdEtaState,
  resolveZdEtaNoMatchFromOrder,
  resolveZdEtaPendingFromOrder,
  resolveZdFulfillmentFromOrder,
  salesTimingLabel,
  salesZdTimingLabel,
  sortMyOrderRows,
  type MyOrderSalesUi,
  type MyOrderZdFulfillment,
} from "@/lib/orders/my-order-sales-ui";
import { resolveLineHistoryEstimateFromTimingLabel } from "@/lib/orders/delivery-date-meta-label";
import {
  salesZdPrimarySlotTimingLabel,
  zdFulfillmentGroupOverdue,
  zdFulfillmentSlots,
} from "@/lib/orders/my-order-zd-fulfillment-display";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  buildPlannedOrderDateDisplay,
  type PlannedOrderDateDisplay,
} from "@/lib/orders/planned-order-date-label";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import {
  formatOrderQuantityLabel,
  getDeliveryProgress,
  isInformacjaRequest,
  type DeliveryProgress,
} from "@/lib/orders/individual";
import { isInformacjaQueueViaDailyPanel } from "@/lib/orders/informacja-via-daily-panel";
import {
  filterIndividualOrdersForSalesMyOrders,
  informacjaFlowPathFromOrder,
  isInformacjaStockOutReorder,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import {
  INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT,
  INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE,
  INFORMACJA_FLOW_SALES_DIRECT,
  INFORMACJA_FLOW_SALES_STOCK_OUT,
  INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED,
} from "@/lib/orders/informacja-flow-copy";
import {
  isAwaitingInformacjaAck,
  isAwaitingSalesPickup,
} from "@/lib/orders/sales-pickup";
import { teethProcurementDeliveryEta, teethProcurementOrderedAt } from "@/lib/teeth/teeth-lifecycle";
import {
  TEETH_SALES_STATUS_NEW_DETAIL,
  TEETH_SALES_STATUS_NEW_TITLE,
  TEETH_SALES_STATUS_ORDERED_TITLE,
  TEETH_SALES_STATUS_VERIFICATION_DETAIL,
  TEETH_SALES_STATUS_VERIFICATION_TITLE,
  teethSalesOrderedStatusDetail,
} from "@/lib/teeth/teeth-procurement-flow-copy";
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
import {
  normalizeSalesRequestNote,
  requestNotesSummary,
} from "@/lib/orders/sales-request-note";
import {
  isProcurementInitiatedCancel,
  normalizeProcurementCancelNote,
  procurementCancelNotesSummary,
  procurementInitiatedCancelStatusCopy,
} from "@/lib/orders/procurement-cancel-note";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import { mapOrderTeethDetailsToEdit } from "@/lib/orders/individual-request-edit";
import { describeVerificationGaps } from "@/lib/orders/verification-gaps";
import {
  canPartialSalesCancel,
  canSalesCancelOrders,
  defaultSalesCancelQuantity,
  deliveryProgressFor,
  fulfillmentProgressFor,
  isSalesCancelNoticePending,
  maxSalesCancelQuantity,
  resolveGroupSalesCancelPhase,
  resolveSalesCancelPhase,
  showSalesCancelRemainderAction,
  showSalesCancelSupplierQuickAction,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import { canEditIndividualRequestGroup } from "@/lib/orders/individual-request-edit";
import { salesCancelUndoRestoreSnapshot } from "@/lib/orders/sales-cancel-db";
import type { SalesCancelUndoRestore } from "@/lib/orders/sales-cancel-db";
import {
  canAcknowledgePickupForOrder,
  classifyMyOrderProductLanes,
  resolveGroupAcknowledgeMode,
  resolveLinePickupAckMode,
  splitPickupPendingIds,
  submissionGroupSplitHint,
} from "@/lib/orders/my-order-lane-meta";

function weryfikacjaPresentation(order: IndividualOrder) {
  return {
    supplierName: order.supplier?.name ?? "Do ustalenia",
    statusTitle: "W dziale dostaw",
    statusDetail: describeVerificationGaps(order),
    timingLabel: null,
    badgeVariant: "warning" as const,
    rowColor: SUMMARY_COLORS.historyVerification,
  };
}

/** Stan pojedynczej pozycji względem magazynu (przy częściowej dostawie grupy). */
export type MyOrderLineStockStatus = "waiting" | "partial" | "on_stock" | "na";

export type MyOrderAcknowledgeMode =
  | "cancelled"
  | "cancel_notice"
  | "pickup"
  | "teeth_handover"
  | "mixed_pickup"
  | "availability"
  | "none";

export type MyOrderLine = {
  id: string;
  product: string;
  symbol: string | null;
  /** Id towaru Subiekt — zachowane przy edycji prośby przez handlowca. */
  subiektTwId: number | null;
  /** Surowa ilość z bazy (do edycji prośby). */
  /** Kod Mikran (tw_PLU) — do edycji prośby. */
  mikranCode: string | null;
  quantity: string;
  quantityLabel: string;
  progressLabel: string | null;
  stockStatus: MyOrderLineStockStatus;
  /** Pozycja gotowa do potwierdzenia odbioru / powiadomienia. */
  canAcknowledgePickup: boolean;
  /** Handlowiec może wycofać tę pozycję (osobno od reszty grupy). */
  canCancelBySales: boolean;
  salesCancelPhase: SalesCancelPhase | null;
  maxSalesCancelQuantity: number | null;
  defaultSalesCancelQuantity: number | null;
  canPartialSalesCancel: boolean;
  showSalesCancelRemainder: boolean;
  /** Jedna szt. u dostawcy po częściowej dostawie — skrót „Zmień ilość”. */
  showSalesCancelSupplierQuick: boolean;
  /** Dostarczone szt. — do dialogu częściowej rezygnacji. */
  salesCancelDeliveredQty: number;
  /** Stan przed rezygnacją — do cofnięcia w oknie undo. */
  salesCancelUndoRestore: SalesCancelUndoRestore;
  clientName: string | null;
  clientKhId: number | null;
  requestNote: string | null;
  procurementCancelNote: string | null;
  /** Termin z ZD dla tej pozycji (grupy wieloproduktowe). */
  zdFulfillment?: MyOrderZdFulfillment | null;
  zdEtaPending?: boolean;
  zdEtaNoMatch?: boolean;
  /** Szacunek z historii — gdy brak terminu w ZD dla tej pozycji. */
  historyEstimateLabel?: string | null;
  historyEstimateLowConfidence?: boolean;
  /** Lista zębów — do edycji prośby zębowej. */
  teethDetails?: TeethLineDetail[];
  /** Linia zębowa (tor panelu zębów). */
  isTeeth?: boolean;
  /** Tryb potwierdzenia odbioru dla tej linii. */
  lineAcknowledgeMode?: import("@/lib/orders/my-order-pickup-ack-copy").MyOrderPickupAckMode | "none";
  /** Przyjęte sztuki per linia spec (klucz: teethReceiveGroupKey). */
  teethLineDelivered?: Record<string, number> | null;
  /** Łączna przyjęta ilość (delivered_quantity z bazy). */
  deliveredQuantity?: string | null;
};

type MyOrderRowCore = {
  id: string;
  kind: "zamowienie" | "informacja";
  /** Liczba produktów w grupie (1 = pojedyncza pozycja). */
  lineCount: number;
  lines: MyOrderLine[];
  submittedLabel: string;
  /** Data dostarczenia na magazyn (jeśli dostępna). */
  deliveryAtLabel?: string | null;
  /** Data zamówienia u dostawcy (jeśli dostępna). */
  orderedAtLabel?: string | null;
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
  /** Czy pozycja jest „zęby" (denormalizowane z individual_orders). */
  isTeeth?: boolean;
  /** Zęby + zwykły towar w jednej karcie. */
  productLaneKind?: import("@/lib/orders/my-order-lane-meta").MyOrderProductLaneKind;
  /** Wspólny identyfikator prośby z formularza (gdy dotyczy). */
  submissionGroupId?: string | null;
  /** Gdy ta sama prośba jest rozbita na kilka kart w /moje. */
  submissionGroupSplitHint?: string | null;
  /** Czy wiersz pochodzi z archiwum (decorateArchivedRow) — wpływa na subline i styl. */
  isArchive?: boolean;
};

export type MyOrderRow = MyOrderRowCore &
  Partial<MyOrderSalesUi> & {
    orderIds: string[];
    acknowledgeMode: MyOrderAcknowledgeMode;
    pickupPendingCount: number;
    pickupPendingIds: string[];
    pickupTeethPendingIds: string[];
    pickupShelfPendingIds: string[];
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
    /** Wspólna notatka do zakupów (meta). */
    requestNote: string | null;
    /** Wspólna wiadomość od zakupów przy anulowaniu (meta). */
    procurementCancelNote: string | null;
    /** Powiązanie z kartą ZK w notatniku (przycisk Prośba). */
    sourceZkWatchId?: string | null;
    sourceZkNumber?: string | null;
    supplierId: string | null;
    salesPersonId: string;
    requestKind: "zamowienie" | "informacja";
    /** Ścieżka prośby informacyjnej — do formularza edycji. */
    informacjaPath?: InformacjaFlowPath;
    canEditBySales: boolean;
    plannedOrderDate?: PlannedOrderDateDisplay | null;
    /** Termin realizacji zsynchronizowany z dokumentu ZD. */
    zdFulfillment?: MyOrderZdFulfillment | null;
    /** Trwa pierwsza synchronizacja terminu z dokumentu ZD. */
    zdEtaPending?: boolean;
    /** Sync zakończony — brak terminu w ZD u dostawcy. */
    zdEtaNoMatch?: boolean;
  };

export type SupplierScheduleSnapshot = {
  computedNextDate: string | null;
  orderOnDemand: boolean;
};

type MyOrderRowDraft = MyOrderRowCore;

export function lineStockStatus(order: IndividualOrder): MyOrderLineStockStatus {
  if (isInformacjaRequest(order)) {
    if (order.status === "Zrealizowane") return "on_stock";
    return "waiting";
  }

  const progress = deliveryProgressFor(order);
  if (!progress.hasNumericQty) {
    return order.status === "Zrealizowane" ? "on_stock" : "waiting";
  }
  const fulfillment = fulfillmentProgressFor(order);
  const target = fulfillment.activeOrdered ?? progress.ordered;
  if (target == null) {
    return order.status === "Zrealizowane" ? "on_stock" : "waiting";
  }
  if (progress.delivered === 0) return "waiting";
  if (progress.delivered >= target) return "on_stock";
  return "partial";
}

function canAcknowledgePickupForOrderLocal(order: IndividualOrder): boolean {
  return canAcknowledgePickupForOrder(order);
}

function resolveAcknowledgeMode(orders: IndividualOrder[]): MyOrderAcknowledgeMode {
  return resolveGroupAcknowledgeMode(orders);
}

function rowToLine(
  row: Pick<
    MyOrderRowDraft,
    "product" | "symbol" | "quantityLabel" | "progressLabel" | "timingLabel"
  > & {
    zdFulfillment?: MyOrderZdFulfillment | null;
    zdEtaPending?: boolean;
    zdEtaNoMatch?: boolean;
  },
  order: IndividualOrder
): MyOrderLine {
  const lineZdFulfillment = row.zdFulfillment ?? null;
  const lineZdEtaPending = Boolean(row.zdEtaPending && !lineZdFulfillment);
  const lineZdEtaNoMatch = Boolean(
    row.zdEtaNoMatch && !lineZdFulfillment && !lineZdEtaPending
  );
  const historyEstimate = resolveLineHistoryEstimateFromTimingLabel(row.timingLabel, {
    zdFulfillment: lineZdFulfillment,
    zdEtaPending: lineZdEtaPending,
    zdEtaNoMatch: lineZdEtaNoMatch,
  });
  const subiektId = order.subiekt_tw_id;
  const subiektTwId =
    typeof subiektId === "number" && Number.isFinite(subiektId) && subiektId > 0
      ? subiektId
      : null;

  return {
    id: order.id,
    product: row.product,
    symbol: row.symbol,
    subiektTwId,
    mikranCode: order.mikran_code?.trim() || null,
    quantity:
      order.quantity !== "-" && order.quantity?.trim()
        ? order.quantity
        : "",
    quantityLabel: row.quantityLabel,
    progressLabel: row.progressLabel,
    stockStatus: lineStockStatus(order),
    canAcknowledgePickup: canAcknowledgePickupForOrderLocal(order),
    ...(() => {
      const salesCancelPhase = resolveSalesCancelPhase(order);
      return {
        canCancelBySales: salesCancelPhase !== null,
        salesCancelPhase,
        maxSalesCancelQuantity: maxSalesCancelQuantity(order),
        defaultSalesCancelQuantity: defaultSalesCancelQuantity(order),
        canPartialSalesCancel: canPartialSalesCancel(order),
        showSalesCancelRemainder: showSalesCancelRemainderAction(order),
        showSalesCancelSupplierQuick: showSalesCancelSupplierQuickAction(order),
        salesCancelDeliveredQty: deliveryProgressFor(order).delivered,
        salesCancelUndoRestore: salesCancelUndoRestoreSnapshot(order),
      };
    })(),
    clientName: order.sales_client_name?.trim() || null,
    clientKhId:
      order.sales_client_kh_id != null && Number.isFinite(Number(order.sales_client_kh_id))
        ? Math.trunc(Number(order.sales_client_kh_id))
        : null,
    requestNote: normalizeSalesRequestNote(order.sales_request_note),
    procurementCancelNote: normalizeProcurementCancelNote(order.procurement_cancel_note),
    zdFulfillment: lineZdFulfillment,
    zdEtaPending: lineZdEtaPending,
    zdEtaNoMatch: lineZdEtaNoMatch,
    historyEstimateLabel: historyEstimate?.label ?? null,
    historyEstimateLowConfidence: historyEstimate?.lowConfidence ?? false,
    teethDetails: mapOrderTeethDetailsToEdit(order.teeth_details),
    isTeeth: Boolean(order.is_teeth),
    lineAcknowledgeMode: resolveLinePickupAckMode(order),
    teethLineDelivered: order.teeth_line_delivered ?? null,
    deliveredQuantity: order.delivered_quantity ?? null,
  };
}

function pickupMeta(orders: IndividualOrder[]) {
  const split = splitPickupPendingIds(orders);
  const readyTotal = orders.filter((o) => o.status === "Zrealizowane").length;
  const acknowledged = orders.filter(
    (o) => o.status === "Zrealizowane" && Boolean(o.sales_acknowledged_at)
  ).length;
  return {
    pickupPendingCount: split.allIds.length,
    pickupPendingIds: split.allIds,
    pickupTeethPendingIds: split.teethIds,
    pickupShelfPendingIds: split.shelfIds,
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
    informacjaPath:
      rep?.request_kind === "informacja"
        ? (informacjaFlowPathFromOrder(rep) ?? "direct")
        : undefined,
    salesCancelPhase: resolveGroupSalesCancelPhase(visible),
    salesCancelOrderIds: visible
      .filter((o) => resolveSalesCancelPhase(o) !== null)
      .map((o) => o.id),
    cancelNoticeOrderIds: visible
      .filter(isSalesCancelNoticePending)
      .map((o) => o.id),
    cancelledAckOrderIds: visible
      .filter((o) => o.status === "Anulowane")
      .map((o) => o.id),
    clientLabel: clientNamesSummary(visible),
    requestNote: requestNotesSummary(visible),
    procurementCancelNote: procurementCancelNotesSummary(visible),
    sourceZkWatchId:
      visible.map((o) => o.source_zk_watch_id).find(Boolean) ??
      orders.map((o) => o.source_zk_watch_id).find(Boolean) ??
      null,
    sourceZkNumber:
      visible.map((o) => o.source_zk_number?.trim()).find(Boolean) ??
      orders.map((o) => o.source_zk_number?.trim()).find(Boolean) ??
      null,
    submissionGroupId:
      visible.map((o) => o.submission_group_id).find(Boolean) ??
      orders.map((o) => o.submission_group_id).find(Boolean) ??
      null,
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
    return `${detail} · Wspólny termin dla wszystkich pozycji.`;
  }
  return detail;
}

function pickRepresentativeOrder(orders: IndividualOrder[]): IndividualOrder {
  const hasMixedOpen =
    orders.some((o) => o.status === "Weryfikacja") &&
    orders.some((o) => o.status === "Nowe");
  if (hasMixedOpen) {
    const verification = orders.find((o) => o.status === "Weryfikacja");
    if (verification) return verification;
  }

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

  if (status === "Weryfikacja") {
    return progress.hasNumericQty ? `Prośba: ${q} szt.` : null;
  }
  if (status === "Nowe") {
    return progress.hasNumericQty ? `Prośba: ${q} szt.` : null;
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

function teethHandoverStatusDetail(
  order: IndividualOrder,
  progress: DeliveryProgress
): string {
  if (!progress.hasNumericQty || progress.ordered == null) {
    return "Dostawa jest doręczana osobiście — nie trafia na regał. Potwierdź odbiór po otrzymaniu od magazynu.";
  }
  const q = progress.ordered;
  const d = progress.delivered;
  if (order.status === "Czesciowo_zrealizowane") {
    const remaining =
      progress.remaining != null && progress.remaining > 0
        ? ` Reszta (${progress.remaining} szt.) czeka u dostawcy.`
        : "";
    return `Magazyn przyjął ${d} z ${q} szt.${remaining} Odbiór osobisty — potwierdź, gdy otrzymasz od magazynu.`;
  }
  return `Magazyn przyjął ${d} z ${q} szt. Odbierz osobiście — nie trafia na regał. Potwierdź odbiór po doręczeniu.`;
}

function presentInformacja(
  order: IndividualOrder,
  stats?: DeliveryStats,
  options?: {
    supplierKhIdsBySupplierId?: import("@/lib/orders/my-order-sales-ui").SupplierKhIdsLookup;
    subiektReachable?: boolean;
  }
): MyOrderRow {
  const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
  const zdFulfillment = resolveZdFulfillmentFromOrder(order);
  const zdEtaPending = resolveZdEtaPendingFromOrder(
    order,
    stats,
    statsMode,
    options?.supplierKhIdsBySupplierId,
    options?.subiektReachable ?? true
  );
  const zdEtaNoMatch = resolveZdEtaNoMatchFromOrder(
    order,
    stats,
    statsMode,
    options?.supplierKhIdsBySupplierId
  );

  let zdTimingLabel: string | null = null;
  if (zdFulfillment) {
    if (zdFulfillment.pendingConfirmation) {
      zdTimingLabel = salesZdPrimarySlotTimingLabel(zdFulfillment, false);
    } else {
      const deadlineDate = parseDateOnly(zdFulfillment.deadline);
      const overdue = deadlineDate != null && isPastExpectedDate(deadlineDate);
      zdTimingLabel = salesZdTimingLabel(
        zdFulfillment.deadline,
        zdFulfillment.dokNr,
        overdue
      );
    }
  }

  const base = {
    id: order.id,
    lineCount: 1,
    lines: [] as MyOrderLine[],
    kind: "informacja" as const,
    submittedLabel: formatPlDate(submittedAt(order).slice(0, 10)),
    deliveryAtLabel: order.delivery_at?.trim()
      ? formatPlDate(order.delivery_at.slice(0, 10))
      : null,
    orderedAtLabel: order.ordered_at?.trim()
      ? formatPlDate(order.ordered_at.slice(0, 10))
      : null,
    supplierName: order.supplier?.name ?? "—",
    product: order.products,
    symbol: order.symbol && order.symbol !== "-" ? order.symbol : null,
    quantityLabel: "—",
    progressLabel: null,
    rowColor: SUMMARY_COLORS.informacja,
    isTeeth: Boolean(order.is_teeth),
    productLaneKind: (order.is_teeth ? "teeth" : "regular") as import("@/lib/orders/my-order-lane-meta").MyOrderProductLaneKind,
  };

  const finalize = (row: MyOrderRowDraft): MyOrderRow => ({
    ...withAckMeta(
      {
        ...row,
        lines: [rowToLine(row, order)],
        lineCount: 1,
      },
      [order]
    ),
    zdFulfillment,
    zdEtaPending,
    zdEtaNoMatch,
  });

  switch (order.status) {
    case "Weryfikacja":
      return finalize({
        ...base,
        ...weryfikacjaPresentation(order),
        timingLabel: zdTimingLabel ?? null,
      });
    case "Nowe":
      if (isInformacjaStockOutReorder(order)) {
        return finalize({
          ...base,
          statusTitle: INFORMACJA_FLOW_SALES_STOCK_OUT.statusTitle,
          statusDetail: INFORMACJA_FLOW_SALES_STOCK_OUT.statusDetail,
          timingLabel: zdTimingLabel,
          badgeVariant: "warning",
        });
      }
      if (order.ordered_at?.trim()) {
        return finalize({
          ...base,
          statusTitle: INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusTitle,
          statusDetail: INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusDetail,
          timingLabel: zdTimingLabel ??
            (order.ordered_at
              ? `Zamówione ${formatPlDate(order.ordered_at.slice(0, 10))}`
              : null),
          badgeVariant: "info",
        });
      }
      if (isInformacjaQueueViaDailyPanel(order)) {
        return finalize({
          ...base,
          statusTitle: INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle,
          statusDetail: INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusDetail,
          timingLabel: zdTimingLabel,
          badgeVariant: "info",
        });
      }
      return finalize({
        ...base,
        statusTitle: INFORMACJA_FLOW_SALES_DIRECT.statusTitle,
        statusDetail: INFORMACJA_FLOW_SALES_DIRECT.statusDetail,
        timingLabel: zdTimingLabel,
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
      if (isProcurementInitiatedCancel(order)) {
        const copy = procurementInitiatedCancelStatusCopy("informacja");
        return finalize({
          ...base,
          statusTitle: copy.statusTitle,
          statusDetail: copy.statusDetail,
          timingLabel: null,
          badgeVariant: "default",
          rowColor: SUMMARY_COLORS.historyCancelled,
        });
      }
      return finalize({
        ...base,
        statusTitle: "Anulowano",
        statusDetail: "Prośba została wycofana. Potwierdź, aby ukryć ją z listy.",
        timingLabel: null,
        badgeVariant: "default",
        rowColor: SUMMARY_COLORS.historyCancelled,
      });
    default:
      if (isInformacjaStockOutReorder(order)) {
        return finalize({
          ...base,
          statusTitle: INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED.statusTitle,
          statusDetail: INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED.statusDetail,
          timingLabel: zdTimingLabel ??
            (order.ordered_at
              ? `Zamówione ${formatPlDate(order.ordered_at.slice(0, 10))}`
              : null),
          badgeVariant: "warning",
        });
      }
      return finalize({
        ...base,
        statusTitle: order.status,
        statusDetail: null,
        timingLabel: zdTimingLabel,
        badgeVariant: "info",
      });
  }
}

function presentZamowienie(
  order: IndividualOrder,
  stats: DeliveryStats | undefined,
  options?: {
    supplierKhIdsBySupplierId?: import("@/lib/orders/my-order-sales-ui").SupplierKhIdsLookup;
    subiektReachable?: boolean;
  }
): MyOrderRow {
  const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
  const progress = fulfillmentProgressFor(order);
  const displayQty = progress.activeOrdered ?? progress.ordered;

  const base = {
    id: order.id,
    lineCount: 1,
    lines: [] as MyOrderLine[],
    kind: "zamowienie" as const,
    submittedLabel: formatPlDate(submittedAt(order).slice(0, 10)),
    deliveryAtLabel: order.delivery_at?.trim()
      ? formatPlDate(order.delivery_at.slice(0, 10))
      : null,
    orderedAtLabel: order.ordered_at?.trim()
      ? formatPlDate(order.ordered_at.slice(0, 10))
      : null,
    supplierName: order.supplier?.name ?? "—",
    product: order.products,
    symbol: order.symbol && order.symbol !== "-" ? order.symbol : null,
    quantityLabel:
      progress.hasNumericQty && displayQty != null
        ? progress.cancelled > 0 && progress.ordered != null
          ? `${displayQty} szt. (z ${progress.ordered} · ${progress.cancelled} wycofane)`
          : `${displayQty} szt.`
        : formatOrderQuantityLabel(order.quantity, order.request_kind),
    progressLabel:
      salesProgressLabel(order.status, progress) ??
      (order.sales_cancelled_at && progress.hasNumericQty
        ? progress.fractionLabel
        : order.delivered_quantity && order.delivered_quantity !== "-"
          ? order.delivered_quantity
          : progress.hasNumericQty && displayQty != null
            ? `${displayQty} szt. zamówione`
            : null),
    rowColor: SUMMARY_COLORS.historyNew,
    isTeeth: Boolean(order.is_teeth),
    productLaneKind: (order.is_teeth ? "teeth" : "regular") as import("@/lib/orders/my-order-lane-meta").MyOrderProductLaneKind,
  };

  const zdFulfillment = resolveZdFulfillmentFromOrder(order);
  const zdEtaPending = resolveZdEtaPendingFromOrder(
    order,
    stats,
    statsMode,
    options?.supplierKhIdsBySupplierId,
    options?.subiektReachable ?? true
  );
  const zdEtaNoMatch = resolveZdEtaNoMatchFromOrder(
    order,
    stats,
    statsMode,
    options?.supplierKhIdsBySupplierId
  );

  const finalize = (
    row: MyOrderRowDraft,
    opts?: { omitDeliveryTiming?: boolean }
  ): MyOrderRow => ({
    ...withAckMeta(
      {
        ...row,
        lines: [rowToLine(row, order)],
        lineCount: 1,
      },
      [order]
    ),
    zdFulfillment: opts?.omitDeliveryTiming ? null : zdFulfillment,
    zdEtaPending: opts?.omitDeliveryTiming ? false : zdEtaPending,
    zdEtaNoMatch: opts?.omitDeliveryTiming ? false : zdEtaNoMatch,
  });

  const placement = orderPlacementAt(order);
  const eta = canEstimateDeliveryEta(order)
    ? placement
      ? estimateDeliveryEta(placement, stats, order.order_type, statsMode)
      : null
    : null;

  let timingLabel: string | null = null;
  const teethDeliveryDate = teethProcurementDeliveryEta(order);
  if (order.is_teeth && teethDeliveryDate) {
    const teethDate = parseDateOnly(teethDeliveryDate);
    const overdue = teethDate != null && isPastExpectedDate(teethDate);
    timingLabel = `Planowana dostawa: ${formatPlDate(teethDeliveryDate)}${overdue ? " · po terminie" : ""}`;
  } else if (zdFulfillment) {
    if (zdFulfillment.pendingConfirmation) {
      timingLabel = salesZdPrimarySlotTimingLabel(zdFulfillment, false);
    } else {
      const deadlineDate = parseDateOnly(zdFulfillment.deadline);
      const overdue =
        deadlineDate != null && isPastExpectedDate(deadlineDate);
      timingLabel = salesZdTimingLabel(
        zdFulfillment.deadline,
        zdFulfillment.dokNr,
        overdue
      );
    }
  } else if (eta) {
    timingLabel = salesTimingLabel(
      eta.expectedDate,
      eta.avgBusinessDays,
      eta.lowConfidence
    );
  }

  const timingBadgeOverdue = zdFulfillment
    ? zdFulfillment.pendingConfirmation
      ? false
      : (() => {
        const d = parseDateOnly(zdFulfillment.deadline);
        return d != null && isPastExpectedDate(d);
      })()
    : eta && isPastExpectedDate(eta.expectedDate);

  switch (order.status) {
    case "Weryfikacja":
      if (order.is_teeth) {
        return finalize({
          ...base,
          statusTitle: TEETH_SALES_STATUS_VERIFICATION_TITLE,
          statusDetail: TEETH_SALES_STATUS_VERIFICATION_DETAIL,
          timingLabel,
          badgeVariant: "purple",
          rowColor: SUMMARY_COLORS.historyNew,
        });
      }
      return finalize({
        ...base,
        ...weryfikacjaPresentation(order),
      });
    case "Nowe":
      if (order.is_teeth) {
        return finalize({
          ...base,
          statusTitle: TEETH_SALES_STATUS_NEW_TITLE,
          statusDetail: TEETH_SALES_STATUS_NEW_DETAIL,
          timingLabel,
          badgeVariant: "purple",
          rowColor: SUMMARY_COLORS.historyNew,
        });
      }
      return finalize({
        ...base,
        statusTitle: "Przed zamówieniem",
        statusDetail:
          ["Prośba jest u działu dostaw. Złożymy zamówienie planowo (z innymi towarami) lub osobno."]
            .filter(Boolean)
            .join(" "),
        timingLabel,
        badgeVariant: "purple",
        rowColor: SUMMARY_COLORS.historyNew,
      });
    case "Zamowione":
      if (order.is_teeth) {
        const teethOrderedAt = teethProcurementOrderedAt(order);
        return finalize({
          ...base,
          statusTitle: TEETH_SALES_STATUS_ORDERED_TITLE,
          statusDetail: teethSalesOrderedStatusDetail(teethOrderedAt, teethDeliveryDate),
          timingLabel,
          badgeVariant: timingBadgeOverdue ? "danger" : "info",
          rowColor: SUMMARY_COLORS.historyPending,
        });
      }
      return finalize({
        ...base,
        statusTitle: "Zamówione",
        statusDetail: [
          orderTypeHintForSales(order.order_type),
          placement ? `Zamówiono ${formatPlDate(placement.slice(0, 10))}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        timingLabel,
        badgeVariant:
          timingBadgeOverdue
            ? "danger"
            : "info",
        rowColor: SUMMARY_COLORS.historyPending,
      });
    case "Czesciowo_zrealizowane":
      return finalize({
        ...base,
        statusTitle: "Częściowo na magazynie",
        statusDetail: order.is_teeth
          ? teethHandoverStatusDetail(order, progress)
          : [
              progress.remaining != null && progress.remaining > 0
                ? `Magazyn przyjął część dostawy (${progress.delivered} z ${progress.ordered} szt.). U dostawcy brakuje jeszcze ${progress.remaining} szt.`
                : "Magazyn przyjął część towaru. Reszta zamówienia czeka u dostawcy.",
            ]
              .filter(Boolean)
              .join(" · "),
        timingLabel,
        badgeVariant: timingBadgeOverdue ? "danger" : "warning",
        rowColor: SUMMARY_COLORS.historyPartial,
      });
    case "Zrealizowane":
      return finalize(
        {
          ...base,
          statusTitle: "Do odbioru",
          statusDetail: order.is_teeth
            ? teethHandoverStatusDetail(order, progress)
            : [
                orderTypeHintForSales(order.order_type),
                "Całość jest na magazynie. Potwierdź odbiór — wtedy wpis zniknie z listy.",
              ]
                .filter(Boolean)
                .join(" · "),
          timingLabel: null,
          badgeVariant: "success",
          rowColor: SUMMARY_COLORS.historyCompleted,
        },
        { omitDeliveryTiming: true }
      );
    case "Anulowane":
      if (isProcurementInitiatedCancel(order)) {
        const copy = procurementInitiatedCancelStatusCopy("zamowienie");
        return finalize({
          ...base,
          statusTitle: copy.statusTitle,
          statusDetail: copy.statusDetail,
          timingLabel: null,
          badgeVariant: "default",
          rowColor: SUMMARY_COLORS.historyCancelled,
        });
      }
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
  statsBySupplier: Record<string, DeliveryStats>,
  options?: {
    supplierKhIdsBySupplierId?: import("@/lib/orders/my-order-sales-ui").SupplierKhIdsLookup;
    subiektReachable?: boolean;
  }
): MyOrderRow {
  const visibleOrders = orders.filter((o) => !o.sales_acknowledged_at);

  if (orders.length === 1) {
    const row = presentMyOrder(orders[0], statsBySupplier, options);
    return withAckMeta(row, orders, visibleOrders);
  }

  const representative = pickRepresentativeOrder(visibleOrders.length ? visibleOrders : orders);
  const base = presentMyOrder(representative, statsBySupplier, options);
  const ordersForZd = (visibleOrders.length ? visibleOrders : orders).filter(
    (order) => !isAwaitingSalesPickup(order) && !isAwaitingInformacjaAck(order)
  );
  const ordersForLines = visibleOrders.length ? visibleOrders : orders;
  const lines = ordersForLines.map((o) => {
    const row = presentMyOrder(o, statsBySupplier, options);
    return rowToLine(row, o);
  });
  const { zdFulfillment, zdEtaPending, zdEtaNoMatch } = aggregateGroupZdEtaState(
    ordersForZd,
    statsBySupplier,
    options?.supplierKhIdsBySupplierId,
    options?.subiektReachable ?? true
  );

  let timingLabel = base.timingLabel;
  let badgeVariant = base.badgeVariant;
  if (zdFulfillment) {
    const slots = zdFulfillmentSlots(zdFulfillment);
    const overdue = zdFulfillment.pendingConfirmation
      ? false
      : zdFulfillmentGroupOverdue(slots);
    timingLabel = salesZdPrimarySlotTimingLabel(zdFulfillment, overdue);
    if (overdue) {
      badgeVariant =
        base.statusTitle === "Częściowo na magazynie" ? "warning" : "danger";
    }
  }

  const laneMeta = classifyMyOrderProductLanes(lines);

  return {
    ...withAckMeta(
      {
        ...base,
        id: myOrderGroupKey(representative),
        lineCount: lines.length,
        lines,
        product: groupProductSummary(lines),
        symbol: null,
        isTeeth: laneMeta.hasTeeth,
        productLaneKind: laneMeta.laneKind,
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
        deliveryAtLabel: (() => {
          const deliveryDates = orders
            .map((o) => o.delivery_at?.trim())
            .filter(Boolean)
            .sort()
            .reverse();
          return deliveryDates[0]
            ? formatPlDate(deliveryDates[0].slice(0, 10))
            : null;
        })(),
        orderedAtLabel: (() => {
          const orderedDates = orders
            .map((o) => o.ordered_at?.trim())
            .filter(Boolean)
            .sort()
            .reverse();
          return orderedDates[0]
            ? formatPlDate(orderedDates[0].slice(0, 10))
            : null;
        })(),
        timingLabel,
        badgeVariant,
      },
      orders,
      visibleOrders
    ),
    zdFulfillment,
    zdEtaPending,
    zdEtaNoMatch,
  };
}

export function presentMyOrder(
  order: IndividualOrder,
  statsBySupplier: Record<string, DeliveryStats>,
  options?: {
    supplierKhIdsBySupplierId?: import("@/lib/orders/my-order-sales-ui").SupplierKhIdsLookup;
    subiektReachable?: boolean;
  }
): MyOrderRow {
  if (isInformacjaRequest(order)) {
    const stats = order.supplier_id ? statsBySupplier[order.supplier_id] : undefined;
    return presentInformacja(order, stats, options);
  }
  const stats = order.supplier_id
    ? statsBySupplier[order.supplier_id]
    : undefined;
  return presentZamowienie(order, stats, options);
}

export function supplierIdsForPlannedOrderSchedule(orders: IndividualOrder[]): string[] {
  const ids = new Set<string>();
  for (const order of orders) {
    if (order.sales_acknowledged_at || !order.supplier_id) continue;
    if (isInformacjaRequest(order)) {
      if (
        order.status === "Nowe" &&
        isInformacjaQueueViaDailyPanel(order) &&
        !order.ordered_at?.trim() &&
        !isInformacjaStockOutReorder(order)
      ) {
        ids.add(order.supplier_id);
      }
      continue;
    }
    if (order.status === "Nowe") {
      ids.add(order.supplier_id);
    }
  }
  return [...ids];
}

function attachPlannedOrderDate(
  row: MyOrderRow,
  supplierScheduleById?: Record<string, SupplierScheduleSnapshot>,
  options?: {
    todayDateKey?: string;
    weekDays?: WeekDayPlan[];
  }
): MyOrderRow {
  if (!row.supplierId || !supplierScheduleById) return row;
  const waitingForSupplierOrder =
    row.statusTitle === "Przed zamówieniem" ||
    row.statusTitle === INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle;
  if (!waitingForSupplierOrder) return row;

  const schedule = supplierScheduleById[row.supplierId];
  if (!schedule) return row;

  const plannedOrderDate = buildPlannedOrderDateDisplay({
    computedNextDate: schedule.computedNextDate,
    orderOnDemand: schedule.orderOnDemand,
    todayDateKey: options?.todayDateKey,
    weekDays: options?.weekDays,
    supplierId: row.supplierId,
  });
  if (!plannedOrderDate) return row;
  return { ...row, plannedOrderDate };
}

export function presentMyOrders(
  orders: IndividualOrder[],
  statsRows: DeliveryStats[],
  options?: {
    supplierScheduleById?: Record<string, SupplierScheduleSnapshot>;
    todayDateKey?: string;
    weekDays?: WeekDayPlan[];
    supplierKhIdsBySupplierId?: import("@/lib/orders/my-order-sales-ui").SupplierKhIdsLookup;
    subiektReachable?: boolean;
  }
): {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
} {
  const statsBySupplier = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  const todayDateKey = options?.todayDateKey ?? formatDateString(todayInWarsaw());
  const salesVisibleOrders = filterIndividualOrdersForSalesMyOrders(orders);
  const zamowienia: MyOrderRow[] = [];
  const informacje: MyOrderRow[] = [];

  const zamowienieOrders = salesVisibleOrders.filter((o) => !isInformacjaRequest(o));
  const informacjaOrders = salesVisibleOrders.filter((o) => isInformacjaRequest(o));

  for (const group of groupOrdersForMyView(zamowienieOrders)) {
    const open = group.filter((o) => !o.sales_acknowledged_at);
    if (!open.length) continue;
    zamowienia.push(presentMyOrderGroup(group, statsBySupplier, options));
  }
  for (const group of groupOrdersForMyView(informacjaOrders)) {
    const open = group.filter((o) => !o.sales_acknowledged_at);
    if (!open.length) continue;
    informacje.push(presentMyOrderGroup(group, statsBySupplier, options));
  }

  const productLineCount = zamowienia.reduce((n, r) => n + r.lineCount, 0)
    + informacje.reduce((n, r) => n + r.lineCount, 0);

  const attachSalesUi = (row: MyOrderRow): MyOrderRow =>
    attachPlannedOrderDate(
      {
        ...row,
        ...enrichMyOrderSalesUi(row),
        submissionGroupSplitHint: submissionGroupSplitHint(
          row.submissionGroupId,
          salesVisibleOrders
        ),
      },
      options?.supplierScheduleById,
      {
        todayDateKey,
        weekDays: options?.weekDays,
      }
    );

  return {
    zamowienia: sortMyOrderRows(zamowienia.map(attachSalesUi)),
    informacje: sortMyOrderRows(informacje.map(attachSalesUi)),
    productLineCount,
  };
}
