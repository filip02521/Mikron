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
import { ZdEtaPendingMeta } from "@/components/orders/ZdEtaPendingMeta";
import { ZdEtaNoMatchMeta } from "@/components/orders/ZdEtaNoMatchMeta";
import { resolveMyOrderHistoryDeliveryEstimate } from "@/lib/orders/delivery-date-meta-label";
import { MyOrderKindBadge } from "@/components/moje/MyOrderKindBadge";
import { MyOrderProductLaneBadge } from "@/components/moje/MyOrderProductLaneBadge";
import { displayProductLaneKind } from "@/lib/orders/my-order-lane-meta";
import { MyOrderSubmissionGroupCallout } from "@/components/moje/MyOrderSubmissionGroupCallout";
import { MyOrderRequestProgressBar } from "@/components/moje/MyOrderRequestProgressBar";
import {
  deriveMyOrderRequestProgress,
  shouldShowMyOrderRequestProgress,
} from "@/lib/orders/my-order-request-progress";
import {
  filterRedundantExpandedMetaFields,
  progressLabelInSubline,
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
  myOrderProductPreviewLine,
} from "@/lib/orders/my-order-row-layout";
import { myOrderExpandedMetaFields } from "@/lib/orders/my-order-sales-ui";
import {
  buildMyOrderDeliveryTimingDisplay,
  shouldShowMyOrderExpandedDeliveryTiming,
} from "@/lib/orders/my-order-delivery-timing-display";
import { isLineZdDetailRedundantWithExpandedGroupTiming } from "@/lib/orders/my-order-zd-fulfillment-display";
import { resolveMyOrderDeliveryRowVisual } from "@/lib/orders/my-order-delivery-urgency";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
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
  mojeSecondaryControlClass,
  panelSegmentFirstClass,
  panelSegmentLastClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
  mojeShipmentBulkPickupFooterClass,
  mojeShipmentExpandedPanelClass,
  mojeShipmentExpandedRowShellClass,
  mojeShipmentLinesHeaderClass,
  mojeShipmentLinesHeaderTitleClass,
  mojeShipmentLinesShellClass,
  mojeShipmentRowClass,
  type MojeShipmentRowVisualTone,
  type MojeShipmentRowArchiveAccent,
} from "@/lib/ui/moje-shipment-row-styles";
import { mojeActionBarShellClass } from "@/lib/ui/surfaces";
import {
  myOrderPickupAckAllLabel,
  myOrderPickupAckLabel,
  myOrderPickupAckLineLabel,
  myOrderPickupAckLineTitle,
  myOrderPickupAckTitle,
  myOrderMixedPickupBulkHint,
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
        "size-4 shrink-0 transition-transform duration-200 transition-colors",
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
  const compactPickup = ackMode === "pickup" || ackMode === "teeth_handover";
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
      teethDetails?: import("@/lib/teeth/teeth-catalog").TeethLineDetail[];
      teethLineDelivered?: Record<string, number> | null;
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
    () =>
      showProgress && listKind === "zamowienie"
        ? resolveMyOrderRowPatternHint(row, suppressedSectionPatterns)
        : null,
    [row, showProgress, listKind, suppressedSectionPatterns]
  );
  const suppressSharedHeadline = myOrderRowSuppressesSharedHeadline(
    row,
    suppressedSectionPatterns ?? EMPTY_MY_ORDER_SECTION_PATTERNS
  );
  const showRowHeadline = !suppressSharedHeadline;

  const needsAck =
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "teeth_handover" ||
    row.acknowledgeMode === "mixed_pickup" ||
    row.acknowledgeMode === "availability";
  const needsCancelAck =
    row.acknowledgeMode === "cancelled" && row.cancelledAckOrderIds.length > 0;
  const needsCancelNoticeAck = row.cancelNoticeOrderIds.length > 0;
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
    row.acknowledgeMode === "availability"
      ? "availability"
      : row.acknowledgeMode === "teeth_handover"
        ? "teeth_handover"
        : row.acknowledgeMode === "mixed_pickup"
          ? "pickup"
          : "pickup";
  const displayLaneKind = displayProductLaneKind(row.productLaneKind, row.acknowledgeMode);
  const isMixedPickup = row.acknowledgeMode === "mixed_pickup";
  const compactPickup = ackMode === "pickup" || ackMode === "teeth_handover" || isMixedPickup;
  const pickupAckLabel = isMixedPickup
    ? myOrderPickupAckLabel(row.pickupPendingIds.length, "pickup", { compact: compactPickup })
    : myOrderPickupAckLabel(row.pickupPendingIds.length, ackMode, { compact: compactPickup });
  const pickupAckTitle = isMixedPickup
    ? "Potwierdź odbiór zębów i towaru z regału — osobno dla każdego typu"
    : myOrderPickupAckTitle(row.pickupPendingIds.length, ackMode);
  const shelfPickup = row.acknowledgeMode === "pickup";

  const showSinglePickup =
    canAcknowledge &&
    needsAck &&
    row.lineCount === 1 &&
    row.lines[0]?.canAcknowledgePickup;
  const showGroupPickup = canAcknowledge && needsAck && row.lineCount > 1;
  const showBulkPickup =
    showGroupPickup &&
    row.pickupPendingCount > 0 &&
    row.pickupPendingIds.length > 0 &&
    !expanded &&
    row.acknowledgeMode !== "mixed_pickup";

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
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "teeth_handover" ||
    row.acknowledgeMode === "mixed_pickup";
  const isUrgent = headlineTone === "warning";
  const isDismiss = headlineTone === "dismiss";
  const isStock = headlineTone === "stock";
  const isInformacja = row.kind === "informacja";
  const zdFulfillment = row.zdFulfillment ?? null;
  const deliveryRowVisual =
    showProgress && listKind === "zamowienie"
      ? resolveMyOrderDeliveryRowVisual(row)
      : listKind === "informacja" && zdFulfillment
        ? resolveMyOrderDeliveryRowVisual(row)
        : null;

  const emphasizeStock =
    showProgress &&
    row.lines.some((l) => l.stockStatus === "on_stock" || l.stockStatus === "partial") &&
    (row.lines.some((l) => l.stockStatus === "waiting") || row.lineCount === 1);

  const expandCtx = { listKind, showGroupPickup };
  const needsExpand = myOrderNeedsExpand(row, expandCtx);
  const collapsedSubline = myOrderCollapsedSubline(row);
  const productPreviewLine = myOrderProductPreviewLine(row);
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
      shouldShowMyOrderRequestProgress(row)
        ? deriveMyOrderRequestProgress(row)
        : null,
    [row]
  );
  const showCollapsedSublineText = shouldShowCollapsedSubline(collapsedSubline, {
    showHeadlineBanner,
    showRowHeadline,
    suppressSharedHeadline,
  });
  const expandedMeta = filterRedundantExpandedMetaFields(
    row,
    [
      { label: "Dostawca", value: row.supplierName },
      ...myOrderExpandedMetaFields(row, showProgress),
    ]
      .filter((field) => field.label !== "Klient")
      .filter((field) => field.label !== "ZK")
      .filter((field) => field.label !== "Uwagi")
      .filter((field) => field.label !== "Od dostaw")
      .filter((field) => field.label !== "Zgłoszono")
      .filter((field) => field.label !== "Zamówiono")
      .filter((field) => field.label !== "Magazyn")
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
  const plannedOrderDate = row.plannedOrderDate ?? null;
  const zdEtaPending = Boolean(row.zdEtaPending && subiektReachable);
  const zdEtaNoMatch = Boolean(row.zdEtaNoMatch && !zdEtaPending);
  const showInformacjaTimingMeta = shouldShowInformacjaEmailSentMeta(row);
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
  const showExpandedStatusBadge = shouldShowExpandedOrderStatusBadge(row, {
    hasRequestProgress: Boolean(requestProgress),
    hasExpandedDeliveryTiming: Boolean(showExpandedDeliveryTiming),
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
      teethDetails: line.teethDetails,
      teethLineDelivered: line.teethLineDelivered,
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
    (row.acknowledgeMode === "pickup" ||
      row.acknowledgeMode === "teeth_handover" ||
      row.acknowledgeMode === "mixed_pickup" ||
      row.acknowledgeMode === "availability") &&
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

  const hideLineClient = false;
  const sharedRequestNote =
    row.requestNote && !isRequestNotesAggregateSummary(row.requestNote)
      ? row.requestNote
      : null;
  const hideLineRequestNote = false;
  const sharedProcurementCancelNote =
    row.procurementCancelNote &&
    !isProcurementCancelNotesAggregateSummary(row.procurementCancelNote)
      ? row.procurementCancelNote
      : null;
  const hideLineProcurementCancelNote = false;
  const expandedLineActionColumn =
    expanded && row.lineCount > 1 && (showGroupPickup || showPerLineCancel);
  const hideLineWarehouseProgress =
    expanded &&
    row.lineCount > 1 &&
    showProgress &&
    Boolean(row.progressLabel?.trim()) &&
    !progressLabelInSubline(row);

  const lineItemProps = (line: MyOrderLine) => {
    const lineAckMode =
      line.lineAcknowledgeMode && line.lineAcknowledgeMode !== "none"
        ? line.lineAcknowledgeMode
        : ackMode;
    return {
    showProgress,
    emphasizeStock,
    compact: true,
    hideWarehouseProgress: hideLineWarehouseProgress,
    hideClientLabel: hideLineClient,
    hideRequestNote: hideLineRequestNote,
    hideProcurementCancelNote: hideLineProcurementCancelNote,
    hideZdLineDetail: isLineZdDetailRedundantWithExpandedGroupTiming(
      row,
      line,
      Boolean(expanded && showExpandedDeliveryTiming)
    ),
    canAcknowledge: showGroupPickup,
    lineActionColumn: expandedLineActionColumn,
    informacjaAck: isInformacjaAck,
    tourPreview,
    pending,
    acknowledgeLineLabel:
      lineAckMode === "teeth_handover"
        ? "Potwierdź zęby"
        : lineAckMode === "pickup"
          ? myOrderPickupAckLineLabel()
          : myOrderPickupAckLineLabel(),
    acknowledgeLineTitle: myOrderPickupAckLineTitle(line.product, lineAckMode),
    onAcknowledgePickup: showGroupPickup
      ? (id: string) => {
          const target = row.lines.find((entry) => entry.id === id);
          const shelf = target?.lineAcknowledgeMode === "pickup";
          onAcknowledgePickup([id], shelf);
        }
      : undefined,
    canEditClient,
    onSaveClient: onSaveClient
      ? async (orderId: string, patch: SalesClientAssignment) => {
          await onSaveClient(orderId, patch);
          setClientEditorLineId(null);
        }
      : undefined,
    openClientEditor: clientEditorLineId === line.id,
    onStartEditClient: canEditClient
      ? () => {
          ensureExpanded();
          setClientEditorLineId(line.id);
        }
      : undefined,
    };
  };

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

  const archiveAccent: MojeShipmentRowArchiveAccent = row.isArchive
    ? row.kind === "informacja"
      ? "informacja"
      : row.statusTitle === "Anulowane" ||
          row.statusTitle === "Częściowo wycofane" ||
          row.statusTitle === "Rezygnacja — towar w drodze" ||
          row.statusTitle === "Rezygnacja — towar na magazynie" ||
          row.statusTitle === "Anulowano"
        ? "cancelled"
        : "completed"
    : "default";

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
          archiveAccent,
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
      {row.submissionGroupSplitHint ? (
        <div className="px-2 pt-1 sm:px-3">
          <MyOrderSubmissionGroupCallout hint={row.submissionGroupSplitHint} />
        </div>
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
            {!showHeadlineBanner && showCollapsedSublineText && collapsedSubline ? (
              <div className="flex min-w-0 items-baseline gap-2">
                <SearchHighlightText
                  text={collapsedSubline}
                  searchQuery={searchQuery}
                  className={cn(
                    "truncate",
                    salesTypography.rowTitle,
                    isStock && "text-sky-800",
                    suppressSharedHeadline &&
                      isUrgent &&
                      "text-amber-900",
                    suppressSharedHeadline &&
                      isStock &&
                      "text-sky-900",
                    suppressSharedHeadline &&
                      headlineTone === "info" &&
                      !isInformacja &&
                      "text-indigo-800",
                    suppressSharedHeadline &&
                      isInformacja &&
                      "text-violet-900"
                  )}
                />
                {row.lineCount > 1 ? (
                  <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-700">
                    +{row.lineCount - 1}
                  </span>
                ) : null}
                <MyOrderKindBadge row={row} listKind={listKind} />
                <MyOrderProductLaneBadge laneKind={displayLaneKind} />
              </div>
            ) : (
              <div className="flex min-w-0 items-baseline gap-2">
                <SearchHighlightText
                  text={productPreviewLine || row.supplierName}
                  searchQuery={searchQuery}
                  className={cn("truncate", salesTypography.rowTitle)}
                />
                {row.lineCount > 1 ? (
                  <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-700">
                    +{row.lineCount - 1}
                  </span>
                ) : null}
                <MyOrderKindBadge row={row} listKind={listKind} />
                <MyOrderProductLaneBadge laneKind={displayLaneKind} />
              </div>
            )}
            {suppressSharedHeadline ? (
              <span className="sr-only">{headline}</span>
            ) : null}
            {showRowHeadline && !expanded && (!showHeadlineBanner || compactPickupOrAvailability || compactCancelAck) ? (
              <SearchHighlightText
                text={headline}
                searchQuery={searchQuery}
                className={headlineClass}
                as="p"
              />
            ) : null}
            {(!showHeadlineBanner && showCollapsedSublineText && collapsedSubline) || productPreviewLine ? (
              <SearchHighlightText
                text={row.supplierName}
                searchQuery={searchQuery}
                className={cn(
                  "mt-0.5 truncate",
                  salesTypography.rowMeta
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
            {/* Client/note/procurement note — only in expanded view */}
          </button>
          {(row.sourceZkNumber || sharedRequestNote || sharedProcurementCancelNote) ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              {sharedRequestNote || sharedProcurementCancelNote ? (
                <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1 py-0.5 text-[10px] font-medium leading-none text-indigo-500" title="Prośba zawiera uwagi">
                  <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
                    <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 .7-.3l3-3a1 1 0 0 0 .3-.7V3a1 1 0 0 0-1-1H3Zm1 2h7v5H8a1 1 0 0 0-1 1v2H4V4Z" />
                  </svg>
                  Uwagi
                </span>
              ) : null}
              {row.sourceZkNumber ? (
                <ZkProsbaLinkChip
                  zkNumber={row.sourceZkNumber}
                  zkWatchId={row.sourceZkWatchId}
                  salesPersonId={row.salesPersonId}
                  searchQuery={searchQuery}
                  className="max-w-full"
                />
              ) : null}
            </div>
          ) : null}
          </div>
          {rowPatternHint &&
          !expanded &&
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
          <div className="hidden min-w-0 max-w-[42%] shrink-0 items-center justify-end gap-2 sm:flex">
            {showInformacjaTimingMeta && row.timingLabel ? (
              <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
            ) : null}
            {!showInformacjaTimingMeta && zdFulfillment ? (
              <ZdFulfillmentDateMeta
                fulfillment={zdFulfillment}
                collapsed
                lines={row.lines}
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

      {/* Mobile meta — single inline row, no border-t duplication */}
      {!expanded &&
      (showStatusBadge ||
        productSummary ||
        plannedOrderDate ||
        zdFulfillment ||
        showZdEtaPendingMeta ||
        showZdEtaNoMatchMeta ||
        showInformacjaTimingMeta ||
        showEstimatedDeliveryMeta) ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5 px-3 pb-1 pt-0 sm:hidden">
          {showInformacjaTimingMeta && row.timingLabel ? (
            <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
          ) : null}
          {!showInformacjaTimingMeta && zdFulfillment ? (
            <ZdFulfillmentDateMeta
              fulfillment={zdFulfillment}
              collapsed
              lines={row.lines}
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

      {needsExpand ? (
        <div
          className={cn(
            "moje-expand-grid",
            expanded && "moje-expand-grid--open"
          )}
          aria-hidden={!expanded}
        >
        <div className="moje-expand-grid-inner">
        <div
          id={panelId}
          role="region"
          aria-label={`Szczegóły: ${row.supplierName}`}
          className={mojeShipmentExpandedPanelClass}
        >
          {requestProgress ? <MyOrderRequestProgressBar track={requestProgress} className="mt-2 -mb-1" /> : null}

          {/* Meta + notes — single row: notes left, meta right */}
          {(expandedMeta.length > 0 || showExpandedStatusBadge || expandedNotes) ? (
            <div className="flex items-start justify-end gap-3 px-3 pt-2 mb-0.5">
              {/* Notes — left (spacer to push meta right) */}
              {expandedNotes ? (
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-start gap-1 rounded bg-sky-50 px-1.5 py-1 text-[10px] leading-snug text-sky-700">
                    <svg viewBox="0 0 16 16" className="mt-0.5 size-3 shrink-0" fill="currentColor" aria-hidden>
                      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
                    </svg>
                    <SearchHighlightText
                      text={expandedNotes}
                      searchQuery={searchQuery}
                      className="text-sky-700"
                    />
                  </span>
                </div>
              ) : null}

              {/* Meta — right */}
              {expandedMeta.length > 0 || showExpandedStatusBadge ? (
                <div className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0 text-[10px] leading-tight">
                  {showExpandedStatusBadge ? (
                    <MyOrderStatusPill
                      label={row.statusTitle}
                      variant={row.badgeVariant}
                      searchQuery={searchQuery}
                      className="text-xs"
                    />
                  ) : null}
                  {expandedMeta.map((f, i) => (
                    <span key={f.label} className="inline-flex items-baseline gap-0.5">
                      {i > 0 ? <span className="text-slate-300">·</span> : null}
                      <span className="font-medium text-indigo-400">{f.label}</span>
                      <SearchHighlightText
                        text={f.value}
                        searchQuery={searchQuery}
                        className={cn(
                          "text-slate-600",
                          f.emphasize && "font-semibold text-amber-700"
                        )}
                      />
                    </span>
                  ))}
                </div>
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
                    showPerLineLaneBadge={row.productLaneKind === "mixed"}
                    {...lineItemProps(line)}
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
                <div className={mojeShipmentBulkPickupFooterClass}>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-slate-600 sm:max-w-[60%]">
                      {isMixedPickup ? (
                        myOrderMixedPickupBulkHint(
                          row.pickupTeethPendingIds.length,
                          row.pickupShelfPendingIds.length
                        )
                      ) : row.pickupPendingIds.length === 1 ? (
                        <>Potwierdź odbiór pozycji oznaczonej powyżej.</>
                      ) : (
                        <>
                          <span className="font-medium text-emerald-900">
                            {row.pickupPendingIds.length}{" "}
                            {row.pickupPendingIds.length < 5 ? "pozycje" : "pozycji"}
                          </span>{" "}
                          czeka na potwierdzenie — pojedynczo po prawej lub wszystkie naraz.
                        </>
                      )}
                    </p>
                    {isMixedPickup ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        {row.pickupTeethPendingIds.length > 0 ? (
                          <MyOrderAckButton
                            variant="bulkPickup"
                            disabled={pending}
                            preview={tourPreview}
                            title={myOrderPickupAckTitle(row.pickupTeethPendingIds.length, "teeth_handover")}
                            ariaLabel={myOrderPickupAckTitle(row.pickupTeethPendingIds.length, "teeth_handover")}
                            onClick={() =>
                              onAcknowledgePickup(row.pickupTeethPendingIds, false)
                            }
                          >
                            {myOrderPickupAckLabel(
                              row.pickupTeethPendingIds.length,
                              "teeth_handover"
                            )}
                          </MyOrderAckButton>
                        ) : null}
                        {row.pickupShelfPendingIds.length > 0 ? (
                          <MyOrderAckButton
                            variant="bulkPickup"
                            disabled={pending}
                            preview={tourPreview}
                            title={myOrderPickupAckTitle(row.pickupShelfPendingIds.length, "pickup")}
                            ariaLabel={myOrderPickupAckTitle(row.pickupShelfPendingIds.length, "pickup")}
                            onClick={() =>
                              onAcknowledgePickup(row.pickupShelfPendingIds, true)
                            }
                          >
                            {myOrderPickupAckLabel(
                              row.pickupShelfPendingIds.length,
                              "pickup"
                            )}
                          </MyOrderAckButton>
                        ) : null}
                      </div>
                    ) : (
                    <MyOrderAckButton
                      variant="bulkPickup"
                      disabled={pending}
                      preview={tourPreview}
                      title={pickupAckTitle}
                      ariaLabel={pickupAckTitle}
                      onClick={() => onAcknowledgePickup(row.pickupPendingIds, shelfPickup)}
                    >
                      {myOrderPickupAckAllLabel()}
                    </MyOrderAckButton>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Delivery timing — below product section */}
          {showExpandedDeliveryTiming && expandedDeliveryTiming ? (
            <div className="flex flex-wrap items-center gap-2 px-3 py-0 text-[10px] leading-tight">
              {showInformacjaTimingMeta && row.timingLabel ? (
                <InformacjaEmailSentMeta timingLabel={row.timingLabel} />
              ) : null}
              {!showInformacjaTimingMeta && zdFulfillment ? (
                <ZdFulfillmentDateMeta
                  fulfillment={zdFulfillment}
                  inline
                  lines={row.lines}
                />
              ) : null}
              {!showInformacjaTimingMeta && showEstimatedDeliveryMeta ? (
                <MyOrderEstimatedDeliveryMeta row={row} inline />
              ) : null}
              {plannedOrderDate ? <PlannedOrderDateMeta display={plannedOrderDate} inline /> : null}
            </div>
          ) : null}

          <div className="flex justify-center px-3 pb-2 pt-1">
            <button
              type="button"
              onClick={handleToggle}
              className={cn(
                mojeSecondaryControlClass,
                "h-auto min-h-0 py-1.5 text-slate-600 hover:text-slate-800"
              )}
            >
              <span className="-rotate-90"><ChevronIcon open={false} /></span>
              Zwiń
            </button>
          </div>
        </div>
        </div>
        </div>
      ) : null}
    </Root>
  );
});
