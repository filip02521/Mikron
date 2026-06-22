"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";
import {
  salesCancelLineAriaLabel,
  salesCancelLineCustomQtyLabel,
  salesCancelLineRemainderLabel,
  salesCancelQuickActionLabel,
  salesCancelOverflowLabel,
  salesCancelSoleOverflowFullLabel,
  type SalesCancelLineContext,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { MyOrderEstimatedDeliveryMeta } from "@/components/moje/MyOrderEstimatedDeliveryMeta";
import {
  InformacjaEmailSentMeta,
  shouldShowInformacjaEmailSentMeta,
} from "@/components/moje/InformacjaEmailSentMeta";
import { ZdFulfillmentDateMeta } from "@/components/orders/ZdFulfillmentDateMeta";
import { ZdFulfillmentDeadlineChangeNotice } from "@/components/orders/ZdFulfillmentDeadlineChangeNotice";
import { ZdEtaPendingMeta } from "@/components/orders/ZdEtaPendingMeta";
import { ZdEtaNoMatchMeta } from "@/components/orders/ZdEtaNoMatchMeta";
import { resolveMyOrderHistoryDeliveryEstimate } from "@/lib/orders/delivery-date-meta-label";
import { MyOrderKindBadge } from "@/components/moje/MyOrderKindBadge";
import { MyOrderRequestProgressBar } from "@/components/moje/MyOrderRequestProgressBar";
import {
  deriveMyOrderRequestProgress,
  shouldShowMyOrderRequestProgress,
} from "@/lib/orders/my-order-request-progress";
import {
  filterRedundantExpandedMetaFields,
  shouldShowCollapsedProductSummary,
  shouldShowCollapsedSubline,
  shouldShowExpandedOrderStatusBadge,
  shouldShowMyOrderHeadlineBanner,
  shouldShowOrderStatusBadge,
} from "@/lib/orders/my-order-card-ui";
import {
  EMPTY_MY_ORDER_SECTION_PATTERNS,
  myOrderRowSuppressesSharedHeadline,
  resolveMyOrderRowPatternHint,
  type MyOrderSectionPatternId,
} from "@/lib/orders/my-order-section-callout";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";
import { myOrderCollapsedMobileTiming } from "@/lib/orders/my-order-collapsed-mobile-timing";
import {
  myOrderCollapsedProductSummary,
  myOrderCollapsedSubline,
  myOrderExpandHint,
  myOrderExpandedNotes,
  myOrderNeedsExpand,
} from "@/lib/orders/my-order-row-layout";
import { myOrderExpandedMetaFields } from "@/lib/orders/my-order-sales-ui";
import { MyOrderExpandedMeta } from "@/components/moje/MyOrderExpandedMeta";
import { MyOrderExpandedDeliveryTiming } from "@/components/moje/MyOrderExpandedDeliveryTiming";
import {
  buildMyOrderDeliveryTimingDisplay,
  shouldShowMyOrderCollapsedDeliveryTiming,
  shouldShowMyOrderExpandedDeliveryTiming,
} from "@/lib/orders/my-order-delivery-timing-display";
import { resolveMyOrderDeliveryRowVisual } from "@/lib/orders/my-order-delivery-urgency";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderRequestNote } from "@/components/moje/MyOrderRequestNote";
import { MyOrderProcurementCancelNote } from "@/components/moje/MyOrderProcurementCancelNote";
import { isRequestNotesAggregateSummary } from "@/lib/orders/sales-request-note";
import { isProcurementCancelNotesAggregateSummary } from "@/lib/orders/procurement-cancel-note";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { MyOrderShipmentOverflowMenu, type MyOrderShipmentOverflowMenuProps } from "@/components/moje/MyOrderShipmentOverflowMenu";
import { MyOrderHeadlineBanner } from "@/components/moje/MyOrderHeadlineBanner";
import { MyOrderRowPatternHint } from "@/components/moje/MyOrderRowPatternHint";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { cn } from "@/lib/cn";
import {
  brandLinkSubtleClass,
  mojeActionOverflowSegmentClass,
  panelSegmentFirstClass,
  panelSegmentLastClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
  mojeShipmentExpandedActionsClass,
  mojeShipmentExpandedNotesClass,
  mojeShipmentExpandedPanelClass,
  mojeShipmentExpandedRowShellClass,
  mojeShipmentLinesHeaderClass,
  mojeShipmentLinesHeaderTitleClass,
  mojeShipmentLinesShellClass,
  mojeShipmentRowClass,
  type MojeShipmentRowVisualTone,
} from "@/lib/ui/moje-shipment-row-styles";
import { mojeActionBarShellClass } from "@/lib/ui/surfaces";
import {
  myOrderPickupAckLabel,
  myOrderPickupAckTitle,
  type MyOrderPickupAckMode,
} from "@/lib/orders/my-order-pickup-ack-copy";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import {
  rowSearchHighlightsProductLines,
  searchQueryTokens,
} from "@/lib/orders/my-order-search";

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn(
        "size-4 shrink-0 transition-transform",
        open ? "rotate-90 text-indigo-700" : "text-slate-500"
      )}
      fill="currentColor"
    >
      <path d="M7.2 4.2a1 1 0 0 1 1.4 0l4.8 4.8a1 1 0 0 1 0 1.4l-4.8 4.8a1 1 0 1 1-1.4-1.4L11.58 10 7.2 5.6a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function ShipmentToolbar({
  overflowMenuProps,
  showSinglePickup,
  showBulkPickup,
  showDismissAck,
  hideSinglePickup = false,
  hideDismissAck = false,
  ackMode,
  dismissAckLabel,
  dismissAckTitle,
  dismissAckIds,
  pending,
  pickupIds,
  pickupCount,
  isAction,
  isInformacjaAck,
  isCancelAck,
  onAcknowledgePickup,
  onAcknowledgeDismiss,
  tourPreview = false,
  shelfPickup = false,
}: {
  overflowMenuProps: Omit<MyOrderShipmentOverflowMenuProps, "variant" | "className" | "triggerClassName"> | null;
  showSinglePickup: boolean;
  showBulkPickup: boolean;
  showDismissAck: boolean;
  hideSinglePickup?: boolean;
  hideDismissAck?: boolean;
  ackMode: MyOrderPickupAckMode;
  dismissAckLabel: string;
  dismissAckTitle: string;
  dismissAckIds: string[];
  pending: boolean;
  pickupIds: string[];
  pickupCount: number;
  isAction: boolean;
  isInformacjaAck: boolean;
  isCancelAck: boolean;
  onAcknowledgePickup: (ids: string[], shelfPickup?: boolean) => void;
  onAcknowledgeDismiss: (ids: string[]) => void;
  tourPreview?: boolean;
  shelfPickup?: boolean;
}) {
  const pendingForLabel = pickupIds.length || pickupCount;
  const compactPickup = ackMode === "pickup";
  const pickupLabel = myOrderPickupAckLabel(pendingForLabel, ackMode, { compact: compactPickup });
  const pickupTitle = myOrderPickupAckTitle(pendingForLabel, ackMode);
  const ackPrimaryVariant = isInformacjaAck ? "segmentInformacja" : "segmentPrimary";
  const ackActionVariant = isInformacjaAck ? "informacjaAck" : "action";

  const hasToolbar =
    overflowMenuProps ||
    (showDismissAck && !hideDismissAck) ||
    showBulkPickup ||
    (showSinglePickup && !hideSinglePickup);
  if (!hasToolbar) return null;

  const ackButtonCount =
    (showDismissAck && !hideDismissAck ? 1 : 0) +
    (showSinglePickup && !hideSinglePickup ? 1 : 0) +
    (showBulkPickup ? 1 : 0);
  const groupedAcks = ackButtonCount > 1;
  const useActionShell = ackButtonCount > 0;
  /** W obudowie segmentowej zawsze warianty płaskich segmentów — nie standalone z rounded-md. */
  const shellSegment = useActionShell;
  const dismissAckVariant = shellSegment || groupedAcks
    ? "segmentCancel"
    : isCancelAck
      ? "cancelAck"
      : isAction
        ? ackActionVariant
        : "inline";
  const pickupAckOnlyToolbar =
    !(showDismissAck && !hideDismissAck) &&
    !overflowMenuProps &&
    (showBulkPickup || (showSinglePickup && !hideSinglePickup));
  const hasOverflow = Boolean(overflowMenuProps);
  const showDismiss = showDismissAck && !hideDismissAck;
  const showSingle = showSinglePickup && !hideSinglePickup;
  const showBulk = showBulkPickup;
  const ackSegmentOrder = (
    [
      showDismiss ? "dismiss" : null,
      showSingle ? "single" : null,
      showBulk ? "bulk" : null,
    ] as const
  ).filter((key): key is "dismiss" | "single" | "bulk" => key != null);
  const ackSegmentRounding = (key: "dismiss" | "single" | "bulk") => {
    const isFirst = ackSegmentOrder[0] === key;
    const isLast = ackSegmentOrder[ackSegmentOrder.length - 1] === key;
    const isSolo = isFirst && isLast && !hasOverflow;
    return cn(
      isSolo && "rounded-md",
      isFirst && !isSolo && panelSegmentFirstClass,
      isLast && !hasOverflow && !isSolo && panelSegmentLastClass
    );
  };

  const overflowMenu = overflowMenuProps ? (
    <MyOrderShipmentOverflowMenu
      {...overflowMenuProps}
      variant={useActionShell ? "segment" : "standalone"}
      className={
        useActionShell
          ? cn(mojeActionOverflowSegmentClass, panelSegmentLastClass)
          : undefined
      }
      triggerClassName={useActionShell ? undefined : "h-10 w-10 sm:h-8 sm:w-8"}
    />
  ) : null;

  const ackButtons = (
    <>
      {showDismissAck && !hideDismissAck ? (
        <MyOrderAckButton
          variant={dismissAckVariant}
          disabled={pending}
          preview={tourPreview}
          title={dismissAckTitle}
          onClick={() => onAcknowledgeDismiss(dismissAckIds)}
          className={ackSegmentRounding("dismiss")}
        >
          {dismissAckLabel}
        </MyOrderAckButton>
      ) : null}
      {showSinglePickup && !hideSinglePickup ? (
        <MyOrderAckButton
          variant={
            shellSegment || groupedAcks || pickupAckOnlyToolbar
              ? groupedAcks
                ? showDismissAck
                  ? ackPrimaryVariant
                  : "segmentOutline"
                : ackPrimaryVariant
              : isAction || isInformacjaAck
                ? ackActionVariant
                : "inline"
          }
          disabled={pending}
          preview={tourPreview}
          title={pickupTitle}
          onClick={() => onAcknowledgePickup(pickupIds, shelfPickup)}
          className={ackSegmentRounding("single")}
        >
          {pickupLabel}
        </MyOrderAckButton>
      ) : null}
      {showBulkPickup ? (
        <MyOrderAckButton
          variant={
            shellSegment || groupedAcks || pickupAckOnlyToolbar
              ? ackPrimaryVariant
              : ackActionVariant
          }
          disabled={pending}
          preview={tourPreview}
          title={pickupTitle}
          onClick={() => onAcknowledgePickup(pickupIds, shelfPickup)}
          className={ackSegmentRounding("bulk")}
        >
          {pickupLabel}
        </MyOrderAckButton>
      ) : null}
    </>
  );

  return (
    <div className="flex w-full shrink-0 flex-wrap items-stretch justify-end gap-1.5 sm:w-auto sm:gap-1.5">
      {useActionShell ? (
        <div className={cn(mojeActionBarShellClass, "w-full justify-end sm:w-auto")}>
          {ackButtons}
          {overflowMenu}
        </div>
      ) : (
        <>
          {ackButtons}
          {overflowMenu}
        </>
      )}
    </div>
  );
}

export const MyOrderShipmentCard = memo(function MyOrderShipmentCard({
  row,
  listKind,
  domId,
  showProgress,
  canAcknowledge,
  pending,
  expanded,
  onToggleRow,
  onAcknowledgePickup,
  onAcknowledgeCancelled,
  onAcknowledgeCancelNotice,
  onCancelRequest,
  onPartialCancelRequest,
  onSaveClient,
  onEditRequest,
  searchQuery,
  tourPreview = false,
  /** W sekcji „Do potwierdzenia” — bez osobnego zielonego paska nad wierszem. */
  compactActionLayout = false,
  suppressedSectionPatterns,
  rowVisualTone = "default",
  highlighted = false,
  subiektReachable = true,
  onAcknowledgeZdDeadlineChange,
  as: Root = "li",
}: {
  row: MyOrderRow;
  listKind: MyOrderListKind;
  domId?: string;
  /** `div` + role=listitem w wirtualnej liście (unika zagnieżdżonych `<li>`). */
  as?: "li" | "div";
  showProgress: boolean;
  canAcknowledge: boolean;
  pending: boolean;
  expanded: boolean;
  onToggleRow?: (rowId: string) => void;
  onAcknowledgePickup: (orderIds: string[], shelfPickup?: boolean) => void;
  onAcknowledgeCancelled?: (orderIds: string[]) => void;
  onAcknowledgeCancelNotice?: (orderIds: string[]) => void;
  onCancelRequest?: (orderIds: string[], lines: SalesCancelLineContext[]) => void;
  onPartialCancelRequest?: (
    orderId: string,
    phase: SalesCancelPhase,
    opts: {
      product: string;
      maxQty: number;
      defaultQty: number;
      deliveredQty?: number;
    }
  ) => void;
  onSaveClient?: (orderId: string, patch: SalesClientAssignment) => void | Promise<void>;
  onEditRequest?: (row: MyOrderRow) => void;
  searchQuery?: string | null;
  tourPreview?: boolean;
  compactActionLayout?: boolean;
  suppressedSectionPatterns?: Set<MyOrderSectionPatternId>;
  rowVisualTone?: MojeShipmentRowVisualTone;
  highlighted?: boolean;
  subiektReachable?: boolean;
  onAcknowledgeZdDeadlineChange?: (orderIds: string[]) => void;
}) {
  const panelId = useId();
  const searchActive = searchQueryTokens(searchQuery).length > 0;
  const searchShowsProductLines =
    searchActive && expanded && rowSearchHighlightsProductLines(row, searchQuery);
  const [linesOpen, setLinesOpen] = useState(false);
  const preSearchLinesOpenRef = useRef<boolean | null>(null);
  const [clientEditorLineId, setClientEditorLineId] = useState<string | null>(null);

  useEffect(() => {
    if (!searchActive) {
      if (preSearchLinesOpenRef.current !== null) {
        setLinesOpen(preSearchLinesOpenRef.current);
        preSearchLinesOpenRef.current = null;
      }
      return;
    }
    if (!searchShowsProductLines) return;
    setLinesOpen((prev) => {
      if (preSearchLinesOpenRef.current === null) preSearchLinesOpenRef.current = prev;
      return true;
    });
  }, [searchShowsProductLines, searchActive]);

  const headline = row.headline ?? row.statusTitle;
  const headlineTone = row.headlineTone ?? "neutral";
  const rowPatternHint = useMemo(
    () => (showProgress && listKind === "zamowienie" ? resolveMyOrderRowPatternHint(row) : null),
    [row, showProgress, listKind]
  );
  const suppressSharedHeadline = myOrderRowSuppressesSharedHeadline(
    row,
    suppressedSectionPatterns ?? EMPTY_MY_ORDER_SECTION_PATTERNS
  );
  const showRowHeadline = !suppressSharedHeadline;

  const needsAck =
    row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability";
  const needsCancelAck =
    row.acknowledgeMode === "cancelled" && row.cancelledAckOrderIds.length > 0;
  const needsCancelNoticeAck =
    row.acknowledgeMode === "cancel_notice" && row.cancelNoticeOrderIds.length > 0;
  const showDismissAck =
    canAcknowledge &&
    (needsCancelAck || needsCancelNoticeAck) &&
    Boolean(
      needsCancelNoticeAck ? onAcknowledgeCancelNotice : onAcknowledgeCancelled
    );
  const dismissAckIds = needsCancelNoticeAck
    ? row.cancelNoticeOrderIds
    : row.cancelledAckOrderIds;
  const dismissAckLabel = "Potwierdź";
  const dismissAckTitle = needsCancelNoticeAck
    ? "Potwierdzam, że zapoznałem/am się z informacją o rezygnacji"
    : "Potwierdzam anulowanie — ukryj z listy";
  const onAcknowledgeDismiss = needsCancelNoticeAck
    ? onAcknowledgeCancelNotice!
    : onAcknowledgeCancelled!;

  const ackMode: MyOrderPickupAckMode =
    row.acknowledgeMode === "availability" ? "availability" : "pickup";
  const compactPickup = ackMode === "pickup";
  const pickupAckLabel = myOrderPickupAckLabel(row.pickupPendingIds.length, ackMode, {
    compact: compactPickup,
  });
  const pickupAckTitle = myOrderPickupAckTitle(row.pickupPendingIds.length, ackMode);
  const shelfPickup = row.acknowledgeMode === "pickup";

  const showSinglePickup =
    canAcknowledge &&
    needsAck &&
    row.lineCount === 1 &&
    row.lines[0]?.canAcknowledgePickup;
  const showGroupPickup = canAcknowledge && needsAck && row.lineCount > 1;
  const showBulkPickup =
    showGroupPickup && row.pickupPendingCount > 0 && row.pickupPendingIds.length > 0 && !expanded;

  const showSalesCancelLink =
    canAcknowledge &&
    !tourPreview &&
    row.canCancelBySales &&
    row.salesCancelPhase &&
    onCancelRequest;
  const showEditLink = canAcknowledge && !tourPreview && row.canEditBySales && onEditRequest;
  const showStatusBadge = shouldShowOrderStatusBadge(row);
  const canEditClient = canAcknowledge && Boolean(onSaveClient);

  const isInformacjaAck =
    row.acknowledgeMode === "availability" && row.pickupPendingCount > 0;
  const isCancelAck = showDismissAck;
  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup";
  const isUrgent = headlineTone === "warning";
  const isDismiss = headlineTone === "dismiss";
  const isStock = headlineTone === "stock";
  const isInformacja = row.kind === "informacja";
  const deliveryRowVisual =
    showProgress && listKind === "zamowienie"
      ? resolveMyOrderDeliveryRowVisual(row)
      : null;

  const emphasizeStock =
    showProgress &&
    row.lines.some((l) => l.stockStatus === "on_stock" || l.stockStatus === "partial") &&
    (row.lines.some((l) => l.stockStatus === "waiting") || row.lineCount === 1);

  const expandCtx = { listKind, showGroupPickup };
  const needsExpand = myOrderNeedsExpand(row, expandCtx);
  const collapsedSubline = myOrderCollapsedSubline(row);
  const showHeadlineBanner = shouldShowMyOrderHeadlineBanner(row, {
    expanded,
    compactActionLayout,
    canAcknowledge,
  });
  const mobileTiming = myOrderCollapsedMobileTiming(row, {
    expanded,
    showProgress,
    collapsedSubline,
  });
  const expandedNotes = myOrderExpandedNotes(row);
  const requestProgress = useMemo(
    () =>
      rowVisualTone !== "archive" && shouldShowMyOrderRequestProgress(row)
        ? deriveMyOrderRequestProgress(row)
        : null,
    [row, rowVisualTone]
  );
  const showCollapsedSublineText = shouldShowCollapsedSubline(collapsedSubline, {
    showHeadlineBanner,
    showRowHeadline,
    suppressSharedHeadline,
  });
  const expandedMeta = filterRedundantExpandedMetaFields(
    row,
    myOrderExpandedMetaFields(row, showProgress)
      .filter((field) => !(field.label === "Klient" && canEditClient))
      .filter((field) => field.label !== "ZK")
  );
  const expandedDeliveryTiming = buildMyOrderDeliveryTimingDisplay(row);
  const showExpandedDeliveryTiming = shouldShowMyOrderExpandedDeliveryTiming(
    row,
    showProgress
  );
  const expandHint = myOrderExpandHint(row, expandCtx);
  const productSummaryRaw = myOrderCollapsedProductSummary(row, listKind);
  const showCollapsedProductSummary = shouldShowCollapsedProductSummary(row, {
    expanded,
    showRowHeadline,
    suppressSharedHeadline,
    hasCollapsedSubline: Boolean(collapsedSubline),
  });
  const productSummary = showCollapsedProductSummary ? productSummaryRaw : null;
  const showCollapsedDeliveryTiming = shouldShowMyOrderCollapsedDeliveryTiming(row);
  const plannedOrderDate =
    showCollapsedDeliveryTiming ? (row.plannedOrderDate ?? null) : null;
  const zdFulfillment =
    showCollapsedDeliveryTiming ? (row.zdFulfillment ?? null) : null;
  const zdEtaPending = Boolean(
    showCollapsedDeliveryTiming && row.zdEtaPending && subiektReachable
  );
  const zdEtaNoMatch = Boolean(
    showCollapsedDeliveryTiming && row.zdEtaNoMatch && !zdEtaPending
  );
  const showInformacjaTimingMeta =
    showCollapsedDeliveryTiming && shouldShowInformacjaEmailSentMeta(row);
  const historyDeliveryEstimate = resolveMyOrderHistoryDeliveryEstimate(row);
  const showEstimatedDeliveryMeta =
    !showInformacjaTimingMeta &&
    !zdFulfillment &&
    historyDeliveryEstimate !== null;
  const showZdEtaPendingMeta = zdEtaPending;
  const showZdEtaPendingWithEstimate =
    zdEtaPending && (historyDeliveryEstimate !== null || zdFulfillment !== null);
  const showZdEtaNoMatchMeta =
    zdEtaNoMatch && !zdEtaPending && !historyDeliveryEstimate && !zdFulfillment;
  const zdDeadlineChangeOrderIds = useMemo(() => {
    const fromLines = row.lines
      .filter((line) => line.zdFulfillment?.deadlineChange)
      .map((line) => line.id);
    if (fromLines.length) return fromLines;
    if (row.zdFulfillment?.deadlineChange) return row.orderIds;
    return [];
  }, [row]);
  const showZdDeadlineChangeDismiss =
    canAcknowledge && zdDeadlineChangeOrderIds.length > 0 && Boolean(onAcknowledgeZdDeadlineChange);
  const showExpandedStatusBadge = shouldShowExpandedOrderStatusBadge(row, {
    hasRequestProgress: Boolean(requestProgress),
  });

  const showAllProductLines = linesOpen || searchShowsProductLines;
  const visibleLines = showAllProductLines ? row.lines : row.lines.slice(0, 8);
  const hasClient = Boolean(row.clientLabel || row.lines.some((l) => l.clientName?.trim()));

  const ensureExpanded = () => {
    if (!expanded && needsExpand) onToggleRow?.(row.id);
  };

  const handleAssignClient = () => {
    ensureExpanded();
    if (row.lineCount === 1 && row.lines[0]) {
      setClientEditorLineId(row.lines[0].id);
      return;
    }
    const unassigned = row.lines.filter((l) => !l.clientName?.trim());
    if (unassigned.length === 1) {
      setClientEditorLineId(unassigned[0]!.id);
    } else {
      setClientEditorLineId(null);
    }
  };

  const unassignedLineCount = row.lines.filter((l) => !l.clientName?.trim()).length;
  const assignClientLabel =
    row.lineCount > 1
      ? unassignedLineCount > 0
        ? "Przypisz klientów przy produktach"
        : "Klienci przy produktach"
      : undefined;

  const handleToggle = () => {
    if (!needsExpand) return;
    if (expanded) setClientEditorLineId(null);
    onToggleRow?.(row.id);
  };

  const soleLine = row.lineCount === 1 ? row.lines[0] : undefined;

  const openPartialCancel = (line: MyOrderLine, defaultQty: number) => {
    if (!line.salesCancelPhase || !onPartialCancelRequest) return;
    const partialDefaultQty = line.defaultSalesCancelQuantity;
    const partialMaxQty = line.maxSalesCancelQuantity ?? partialDefaultQty ?? 1;
    onPartialCancelRequest(line.id, line.salesCancelPhase, {
      product: line.product,
      maxQty: partialMaxQty,
      defaultQty,
      deliveredQty: line.salesCancelDeliveredQty,
    });
  };

  const partialCustomDefaultQty = (line: MyOrderLine) => {
    if (line.showSalesCancelRemainder || line.showSalesCancelSupplierQuick) return 1;
    if (line.salesCancelPhase === "in_transit") return 1;
    return line.defaultSalesCancelQuantity ?? 1;
  };

  const showPerLineCancel =
    canAcknowledge &&
    !tourPreview &&
    Boolean(onCancelRequest || onPartialCancelRequest) &&
    (row.lineCount > 1 || Boolean(soleLine?.canCancelBySales));
  const cancelOverflowLabel = salesCancelOverflowLabel(
    row.kind,
    row.salesCancelOrderIds.length
  );

  const soleOverflowRemainder =
    Boolean(soleLine?.canCancelBySales) &&
    Boolean(soleLine?.showSalesCancelRemainder) &&
    soleLine?.defaultSalesCancelQuantity != null;
  const soleOverflowQuick =
    Boolean(soleLine?.canCancelBySales) &&
    Boolean(soleLine?.showSalesCancelSupplierQuick);
  const soleOverflowCustom =
    Boolean(soleLine?.canCancelBySales && soleLine?.canPartialSalesCancel);
  const soleOverflowFull =
    Boolean(showSalesCancelLink) &&
    row.lineCount === 1 &&
    Boolean(soleLine?.canCancelBySales) &&
    !soleOverflowRemainder &&
    !soleOverflowQuick;
  const soleOverflowCancelLabel =
    soleLine != null ? salesCancelSoleOverflowFullLabel(row.kind) : undefined;

  const overflowMenuProps: Omit<
    MyOrderShipmentOverflowMenuProps,
    "variant" | "className" | "triggerClassName"
  > | null =
    canAcknowledge && !tourPreview
      ? {
          supplierName: row.supplierName,
          listKind: row.kind,
          disabled: pending,
          hasClient,
          canAssignClient: canEditClient && row.lineCount > 0,
          assignClientLabel: assignClientLabel,
          canEdit: Boolean(showEditLink),
          canCancel: row.lineCount > 1 ? Boolean(showSalesCancelLink) : soleOverflowFull,
          cancelLabel:
            row.lineCount > 1 ? cancelOverflowLabel : soleOverflowCancelLabel,
          canPartialCancelQuick: soleOverflowQuick,
          partialCancelQuickLabel: soleLine ? salesCancelQuickActionLabel() : undefined,
          onPartialCancelQuick:
            soleLine && soleOverflowQuick
              ? () => openPartialCancel(soleLine, 1)
              : undefined,
          canPartialCancelRemainder: soleOverflowRemainder,
          partialCancelRemainderLabel:
            soleLine?.defaultSalesCancelQuantity != null
              ? salesCancelLineRemainderLabel(soleLine.defaultSalesCancelQuantity)
              : undefined,
          onPartialCancelRemainder:
            soleLine && soleOverflowRemainder
              ? () => openPartialCancel(soleLine, soleLine.defaultSalesCancelQuantity!)
              : undefined,
          canPartialCancelCustom: soleOverflowCustom,
          partialCancelCustomLabel: salesCancelLineCustomQtyLabel(),
          onPartialCancelCustom:
            soleLine && soleOverflowCustom
              ? () => openPartialCancel(soleLine, partialCustomDefaultQty(soleLine))
              : undefined,
          onAssignClient: handleAssignClient,
          onEdit: () => onEditRequest?.(row),
          onCancel: () => {
            const cancellableLines = row.lines
              .filter(
                (l) =>
                  row.salesCancelOrderIds.includes(l.id) && l.salesCancelPhase
              )
              .map((l) => ({ product: l.product, phase: l.salesCancelPhase! }));
            onCancelRequest?.(row.salesCancelOrderIds, cancellableLines);
          },
        }
      : null;

  const compactPickupOrAvailability =
    compactActionLayout &&
    !expanded &&
    (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") &&
    needsAck;
  const compactCancelAck =
    compactActionLayout && !expanded && isCancelAck;

  const bannerAckInHeadline =
    showHeadlineBanner && (Boolean(showSinglePickup) || Boolean(showDismissAck));
  const bannerPickup = bannerAckInHeadline && Boolean(showSinglePickup);
  const bannerDismiss = bannerAckInHeadline && Boolean(showDismissAck) && !showSinglePickup;

  const bannerAction = bannerPickup ? (
    <MyOrderAckButton
      variant={isInformacjaAck ? "bannerInformacja" : "banner"}
      disabled={pending}
      preview={tourPreview}
      title={pickupAckTitle}
      ariaLabel={pickupAckTitle}
      onClick={() => onAcknowledgePickup(row.pickupPendingIds, shelfPickup)}
    >
      {pickupAckLabel}
    </MyOrderAckButton>
  ) : bannerDismiss ? (
    <MyOrderAckButton
      variant="cancelAck"
      disabled={pending}
      preview={tourPreview}
      title={dismissAckTitle}
      ariaLabel={dismissAckTitle}
      onClick={() => onAcknowledgeDismiss(dismissAckIds)}
    >
      {dismissAckLabel}
    </MyOrderAckButton>
  ) : undefined;

  const toolbar = (
    <ShipmentToolbar
      overflowMenuProps={overflowMenuProps}
      showSinglePickup={Boolean(showSinglePickup)}
      showBulkPickup={Boolean(showBulkPickup)}
      showDismissAck={Boolean(showDismissAck)}
      hideSinglePickup={bannerPickup}
      hideDismissAck={bannerDismiss}
      ackMode={ackMode}
      isInformacjaAck={isInformacjaAck}
      dismissAckLabel={dismissAckLabel}
      dismissAckTitle={dismissAckTitle}
      dismissAckIds={dismissAckIds}
      pending={pending}
      pickupIds={row.pickupPendingIds}
      pickupCount={row.pickupPendingCount}
      isAction={isAction}
      isCancelAck={isCancelAck}
      onAcknowledgePickup={onAcknowledgePickup}
      onAcknowledgeDismiss={onAcknowledgeDismiss}
      tourPreview={tourPreview}
      shelfPickup={shelfPickup}
    />
  );

  const hideLineClient =
    !expanded &&
    row.lineCount === 1 &&
    Boolean(row.clientLabel) &&
    !canEditClient;
  const sharedRequestNote =
    row.requestNote && !isRequestNotesAggregateSummary(row.requestNote)
      ? row.requestNote
      : null;
  const hideLineRequestNote = Boolean(sharedRequestNote) && !expanded;
  const sharedProcurementCancelNote =
    row.procurementCancelNote &&
    !isProcurementCancelNotesAggregateSummary(row.procurementCancelNote)
      ? row.procurementCancelNote
      : null;
  const hideLineProcurementCancelNote = Boolean(sharedProcurementCancelNote);

  const lineItemProps = (lineId: string) => ({
    showProgress,
    emphasizeStock,
    compact: true,
    hideClientLabel: hideLineClient,
    hideRequestNote: hideLineRequestNote,
    hideProcurementCancelNote: hideLineProcurementCancelNote,
    canAcknowledge: showGroupPickup,
    pending,
    acknowledgeLineLabel: myOrderPickupAckLabel(1, ackMode, { compact: compactPickup }),
    acknowledgeLineTitle: pickupAckTitle,
    onAcknowledgePickup: showGroupPickup
      ? (id: string) => onAcknowledgePickup([id], shelfPickup)
      : undefined,
    canEditClient,
    onSaveClient: onSaveClient
      ? async (orderId: string, patch: SalesClientAssignment) => {
          await onSaveClient(orderId, patch);
          setClientEditorLineId(null);
        }
      : undefined,
    openClientEditor: clientEditorLineId === lineId,
    onStartEditClient: canEditClient
      ? () => {
          ensureExpanded();
          setClientEditorLineId(lineId);
        }
      : undefined,
  });

  const headlineClass = cn(
    salesTypography.rowBody,
    "truncate",
    isAction && "text-emerald-800",
    isInformacjaAck && "font-medium text-violet-900",
    isDismiss && "font-semibold text-amber-950",
    isUrgent && "text-amber-900",
    isStock && "text-sky-900",
    isInformacja &&
      !isAction &&
      !isInformacjaAck &&
      !isUrgent &&
      !isStock &&
      !isDismiss &&
      "font-medium text-violet-900",
    headlineTone === "info" &&
      !isAction &&
      !isUrgent &&
      !isStock &&
      !isInformacja &&
      !isDismiss &&
      "text-indigo-800",
    !isAction &&
      !isUrgent &&
      !isStock &&
      headlineTone !== "info" &&
      !isInformacja &&
      !isDismiss &&
      "text-slate-600"
  );

  const bannerSubline = collapsedSubline;

  return (
    <Root
      id={domId}
      {...(Root === "div" ? { role: "listitem" as const } : {})}
      className={cn(
        mojeShipmentRowClass({
          expanded,
          isAction,
          isInformacjaAck,
          isCancelAck,
          isUrgent,
          isStock,
          isInformacja,
          visualTone: rowVisualTone,
          deliveryBorderAccent: deliveryRowVisual?.borderAccent,
          deliveryCollapsedBg: deliveryRowVisual?.collapsedBg,
        }),
        expanded && needsExpand && mojeShipmentExpandedRowShellClass,
        highlighted && "z-[2] ring-2 ring-inset ring-indigo-300/80"
      )}
    >
      {showHeadlineBanner ? (
        <MyOrderHeadlineBanner
          headline={headline}
          subline={bannerSubline}
          tone={headlineTone}
          action={bannerAction}
        />
      ) : null}
      <div className={cn("px-2 py-1.5 sm:px-3 sm:py-2", mojeQueueRowLayoutClass)}>
        <div className={mojeQueueRowMainClass}>
        <button
          type="button"
          data-moje-row-toggle=""
          onClick={handleToggle}
          disabled={!needsExpand}
          aria-expanded={needsExpand ? expanded : undefined}
          aria-controls={needsExpand ? panelId : undefined}
          aria-label={
            needsExpand
              ? `${expanded ? "Zwiń" : expandHint}: ${row.supplierName}`
              : row.supplierName
          }
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center text-slate-500 sm:h-8 sm:w-8",
            needsExpand && "hover:bg-slate-100 hover:text-indigo-700"
          )}
        >
          {needsExpand ? <ChevronIcon open={expanded} /> : null}
        </button>

        <div className="flex min-w-0 flex-1 items-start gap-1">
          <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={handleToggle}
            disabled={!needsExpand}
            className={cn(
              "w-full text-left",
              needsExpand &&
                "hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-300"
            )}
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <SearchHighlightText
                text={row.supplierName}
                searchQuery={searchQuery}
                className={cn("truncate", salesTypography.rowTitle)}
              />
              <MyOrderKindBadge row={row} listKind={listKind} />
            </div>
            {suppressSharedHeadline ? (
              <span className="sr-only">{headline}</span>
            ) : null}
            {showRowHeadline && (!showHeadlineBanner || compactPickupOrAvailability || compactCancelAck) ? (
              <SearchHighlightText
                text={headline}
                searchQuery={searchQuery}
                className={headlineClass}
                as="p"
              />
            ) : null}
            {!showHeadlineBanner && !expanded && showCollapsedSublineText && collapsedSubline ? (
              <SearchHighlightText
                text={collapsedSubline}
                searchQuery={searchQuery}
                className={cn(
                  "mt-0.5 truncate",
                  salesTypography.rowMeta,
                  isStock && "font-medium text-sky-800",
                  suppressSharedHeadline &&
                    isUrgent &&
                    "font-medium text-amber-900",
                  suppressSharedHeadline &&
                    isStock &&
                    "font-medium text-sky-900",
                  suppressSharedHeadline &&
                    headlineTone === "info" &&
                    !isInformacja &&
                    "font-medium text-indigo-800",
                  suppressSharedHeadline &&
                    isInformacja &&
                    "font-medium text-violet-900"
                )}
                as="p"
              />
            ) : null}
            {!showHeadlineBanner && mobileTiming ? (
              <SearchHighlightText
                text={mobileTiming}
                searchQuery={searchQuery}
                className={cn(
                  "mt-0.5 truncate font-medium tabular-nums sm:hidden",
                  salesTypography.rowMeta,
                  isUrgent && "text-amber-900",
                  isStock && "text-sky-800",
                  !isUrgent && !isStock && "text-slate-600"
                )}
                as="p"
              />
            ) : null}
            {!expanded && row.clientLabel ? (
              <MyOrderAssignedClient
                name={row.clientLabel}
                searchQuery={searchQuery}
                className="mt-0.5 max-w-full truncate"
              />
            ) : null}
            {!expanded && sharedRequestNote ? (
              <MyOrderRequestNote
                note={sharedRequestNote}
                searchQuery={searchQuery}
                className="mt-0.5 line-clamp-2 max-w-full"
              />
            ) : null}
            {!expanded && sharedProcurementCancelNote ? (
              <MyOrderProcurementCancelNote
                note={sharedProcurementCancelNote}
                searchQuery={searchQuery}
                className="mt-0.5 line-clamp-2 max-w-full"
              />
            ) : null}
          </button>
          {row.sourceZkNumber ? (
            <ZkProsbaLinkChip
              zkNumber={row.sourceZkNumber}
              zkWatchId={row.sourceZkWatchId}
              salesPersonId={row.salesPersonId}
              searchQuery={searchQuery}
              className="mt-0.5 max-w-full truncate"
            />
          ) : null}
          </div>
          {rowPatternHint &&
          showRowHeadline &&
          (!showHeadlineBanner || compactPickupOrAvailability || compactCancelAck) ? (
            <MyOrderRowPatternHint
              message={rowPatternHint.message}
              tone={rowPatternHint.tone}
              className="mt-0.5"
            />
          ) : null}
        </div>

        {!expanded ? (
          <div className="hidden min-w-0 max-w-[46%] shrink-0 flex-col items-end gap-1 sm:flex">
            {showInformacjaTimingMeta && row.timingLabel ? (
              <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
            ) : null}
            {!showInformacjaTimingMeta && zdFulfillment ? (
              <ZdFulfillmentDateMeta
                fulfillment={zdFulfillment}
                collapsed
                lines={row.lines}
                showDeadlineChangeDismiss={showZdDeadlineChangeDismiss}
                dismissDeadlineChangePending={pending}
                onDismissDeadlineChange={
                  showZdDeadlineChangeDismiss
                    ? () => onAcknowledgeZdDeadlineChange?.(zdDeadlineChangeOrderIds)
                    : undefined
                }
              />
            ) : null}
            {!showInformacjaTimingMeta && showEstimatedDeliveryMeta ? (
              <MyOrderEstimatedDeliveryMeta row={row} />
            ) : null}
            {showZdEtaPendingMeta ? (
              <ZdEtaPendingMeta compact={showZdEtaPendingWithEstimate} />
            ) : null}
            {showZdEtaNoMatchMeta ? <ZdEtaNoMatchMeta /> : null}
            {plannedOrderDate ? <PlannedOrderDateMeta display={plannedOrderDate} /> : null}
            {showStatusBadge ? (
              <MyOrderStatusPill
                label={row.statusTitle}
                variant={row.badgeVariant}
                searchQuery={searchQuery}
              />
            ) : null}
            {productSummary ? (
              <SearchHighlightText
                text={productSummary}
                searchQuery={searchQuery}
                className={cn("font-medium tabular-nums text-slate-500", salesTypography.rowMeta)}
              />
            ) : null}
          </div>
        ) : null}
        </div>

        <div
          className={mojeQueueRowActionsClass}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {toolbar}
        </div>
      </div>

      {!expanded &&
      (showStatusBadge ||
        productSummary ||
        plannedOrderDate ||
        zdFulfillment ||
        showZdEtaPendingMeta ||
        showZdEtaNoMatchMeta ||
        showInformacjaTimingMeta ||
        showEstimatedDeliveryMeta) ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100/80 px-3 pb-1.5 pt-0 sm:hidden">
          {showInformacjaTimingMeta && row.timingLabel ? (
            <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
          ) : null}
          {!showInformacjaTimingMeta && zdFulfillment ? (
            <ZdFulfillmentDateMeta
              fulfillment={zdFulfillment}
              collapsed
              lines={row.lines}
              showDeadlineChangeDismiss={showZdDeadlineChangeDismiss}
              dismissDeadlineChangePending={pending}
              onDismissDeadlineChange={
                showZdDeadlineChangeDismiss
                  ? () => onAcknowledgeZdDeadlineChange?.(zdDeadlineChangeOrderIds)
                  : undefined
              }
            />
          ) : null}
          {!showInformacjaTimingMeta && showEstimatedDeliveryMeta ? (
            <MyOrderEstimatedDeliveryMeta row={row} />
          ) : null}
          {showZdEtaPendingMeta ? (
            <ZdEtaPendingMeta compact={showZdEtaPendingWithEstimate} />
          ) : null}
          {showZdEtaNoMatchMeta ? <ZdEtaNoMatchMeta /> : null}
          {plannedOrderDate ? <PlannedOrderDateMeta display={plannedOrderDate} /> : null}
          {showStatusBadge ? (
            <MyOrderStatusPill
              label={row.statusTitle}
              variant={row.badgeVariant}
              searchQuery={searchQuery}
            />
          ) : null}
          {productSummary ? (
            <SearchHighlightText
              text={productSummary}
              searchQuery={searchQuery}
              className={cn("font-medium text-slate-500", salesTypography.rowMeta)}
            />
          ) : null}
        </div>
      ) : null}

      {needsExpand && expanded ? (
        <div
          id={panelId}
          role="region"
          aria-label={`Szczegóły: ${row.supplierName}`}
          className={mojeShipmentExpandedPanelClass}
        >
          {requestProgress ? <MyOrderRequestProgressBar track={requestProgress} /> : null}

          {(showExpandedStatusBadge || expandedNotes) && (
            <div className="space-y-2">
              {showExpandedStatusBadge ? (
                <MyOrderStatusPill
                  label={row.statusTitle}
                  variant={row.badgeVariant}
                  searchQuery={searchQuery}
                  className="text-xs"
                />
              ) : null}
              {expandedNotes ? (
                <SearchHighlightText
                  text={expandedNotes}
                  searchQuery={searchQuery}
                  className={mojeShipmentExpandedNotesClass}
                  as="p"
                />
              ) : null}
            </div>
          )}

          <MyOrderExpandedMeta fields={expandedMeta} searchQuery={searchQuery} />

          {showExpandedDeliveryTiming && expandedDeliveryTiming ? (
            <div className="space-y-2">
              <MyOrderExpandedDeliveryTiming
                display={expandedDeliveryTiming}
                searchQuery={searchQuery}
              />
              {row.zdFulfillment?.deadlineChange ? (
                <ZdFulfillmentDeadlineChangeNotice
                  change={row.zdFulfillment.deadlineChange}
                  align="start"
                  className="w-full"
                  onDismiss={
                    showZdDeadlineChangeDismiss
                      ? () => onAcknowledgeZdDeadlineChange?.(zdDeadlineChangeOrderIds)
                      : undefined
                  }
                  dismissPending={pending}
                />
              ) : null}
            </div>
          ) : null}

          {row.lineCount > 0 ? (
            <div className={mojeShipmentLinesShellClass}>
              <div className={mojeShipmentLinesHeaderClass}>
                <p className={mojeShipmentLinesHeaderTitleClass}>
                  {row.lineCount > 1 ? productSummaryRaw ?? "Produkty" : "Produkt"}
                </p>
                {row.lineCount > 8 ? (
                  <button
                    type="button"
                    onClick={() => setLinesOpen((v) => !v)}
                    className={cn("text-xs font-medium", brandLinkSubtleClass)}
                  >
                    {showAllProductLines ? "Zwiń listę" : "Pokaż wszystkie"}
                  </button>
                ) : null}
              </div>
              <ul>
                {(row.lineCount > 8 ? visibleLines : row.lines).map((line, i) => (
                  <MyOrderLineItem
                    key={line.id}
                    line={line}
                    index={i}
                    searchQuery={searchQuery}
                    listKind={row.kind}
                    {...lineItemProps(line.id)}
                    canCancelLine={showPerLineCancel}
                    cancelLineAriaLabel={salesCancelLineAriaLabel(row.kind, line.product)}
                    onCancelLine={
                      showPerLineCancel
                        ? (orderId, phase) =>
                            onCancelRequest?.([orderId], [
                              { product: line.product, phase },
                            ])
                        : undefined
                    }
                    onPartialCancelLine={
                      showPerLineCancel ? onPartialCancelRequest : undefined
                    }
                  />
                ))}
              </ul>
              {!showAllProductLines && row.lineCount > 8 ? (
                <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
                  … i jeszcze {row.lineCount - 8}{" "}
                  {row.lineCount - 8 === 1 ? "pozycja" : "pozycje"}
                </p>
              ) : null}
              {showGroupPickup && row.pickupPendingIds.length ? (
                <div className={mojeShipmentExpandedActionsClass}>
                  <div className={mojeActionBarShellClass}>
                    <MyOrderAckButton
                      variant="segmentPrimary"
                      className="rounded-md"
                      disabled={pending}
                      preview={tourPreview}
                      title={pickupAckTitle}
                      ariaLabel={pickupAckTitle}
                      onClick={() => onAcknowledgePickup(row.pickupPendingIds, shelfPickup)}
                    >
                      {myOrderPickupAckLabel(row.pickupPendingIds.length, ackMode, {
                        compact: compactPickup,
                      })}
                    </MyOrderAckButton>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Root>
  );
});
