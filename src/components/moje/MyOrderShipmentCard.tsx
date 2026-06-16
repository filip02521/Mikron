"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";
import {
  salesCancelLineAriaLabel,
  salesCancelLineCustomQtyLabel,
  salesCancelLineRemainderLabel,
  salesCancelLineShortLabel,
  salesCancelOverflowLabel,
  type SalesCancelLineContext,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
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
  shouldShowMyOrderExpandedDeliveryTiming,
} from "@/lib/orders/my-order-delivery-timing-display";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderRequestNote } from "@/components/moje/MyOrderRequestNote";
import { MyOrderProcurementCancelNote } from "@/components/moje/MyOrderProcurementCancelNote";
import { isRequestNotesAggregateSummary } from "@/lib/orders/sales-request-note";
import { isProcurementCancelNotesAggregateSummary } from "@/lib/orders/procurement-cancel-note";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { MyOrderShipmentOverflowMenu } from "@/components/moje/MyOrderShipmentOverflowMenu";
import { MyOrderHeadlineBanner } from "@/components/moje/MyOrderHeadlineBanner";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, panelSegmentLastClass, salesTypography } from "@/lib/ui/ontime-theme";
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
  overflowMenu,
  showSinglePickup,
  showBulkPickup,
  showDismissAck,
  hideSinglePickup = false,
  ackMode,
  dismissAckLabel,
  dismissAckTitle,
  dismissAckIds,
  pending,
  pickupIds,
  pickupCount,
  isAction,
  isInformacjaAck,
  onAcknowledgePickup,
  onAcknowledgeDismiss,
  tourPreview = false,
  shelfPickup = false,
}: {
  overflowMenu: React.ReactNode;
  showSinglePickup: boolean;
  showBulkPickup: boolean;
  showDismissAck: boolean;
  hideSinglePickup?: boolean;
  ackMode: MyOrderPickupAckMode;
  dismissAckLabel: string;
  dismissAckTitle: string;
  dismissAckIds: string[];
  pending: boolean;
  pickupIds: string[];
  pickupCount: number;
  isAction: boolean;
  isInformacjaAck: boolean;
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
    overflowMenu ||
    showDismissAck ||
    showBulkPickup ||
    (showSinglePickup && !hideSinglePickup);
  if (!hasToolbar) return null;

  const ackButtonCount =
    (showDismissAck ? 1 : 0) +
    (showSinglePickup && !hideSinglePickup ? 1 : 0) +
    (showBulkPickup ? 1 : 0);
  const groupedAcks = ackButtonCount > 1;
  const pickupAckOnlyToolbar =
    !showDismissAck &&
    !overflowMenu &&
    (showBulkPickup || (showSinglePickup && !hideSinglePickup));

  const ackButtons = (
    <>
      {showDismissAck ? (
        <MyOrderAckButton
          variant={groupedAcks ? "segmentOutline" : isAction ? ackActionVariant : "inline"}
          disabled={pending}
          preview={tourPreview}
          title={dismissAckTitle}
          onClick={() => onAcknowledgeDismiss(dismissAckIds)}
          className={cn(groupedAcks && ackButtonCount === 1 && panelSegmentLastClass)}
        >
          {dismissAckLabel}
        </MyOrderAckButton>
      ) : null}
      {showSinglePickup && !hideSinglePickup ? (
        <MyOrderAckButton
          variant={
            groupedAcks
              ? showDismissAck
                ? ackPrimaryVariant
                : "segmentOutline"
              : pickupAckOnlyToolbar
                ? ackPrimaryVariant
                : isAction || isInformacjaAck
                  ? ackActionVariant
                  : "inline"
          }
          disabled={pending}
          preview={tourPreview}
          title={pickupTitle}
          onClick={() => onAcknowledgePickup(pickupIds, shelfPickup)}
          className={cn(
            groupedAcks && !showBulkPickup && panelSegmentLastClass,
            pickupAckOnlyToolbar && panelSegmentLastClass
          )}
        >
          {pickupLabel}
        </MyOrderAckButton>
      ) : null}
      {showBulkPickup ? (
        <MyOrderAckButton
          variant={
            groupedAcks || pickupAckOnlyToolbar ? ackPrimaryVariant : ackActionVariant
          }
          disabled={pending}
          preview={tourPreview}
          title={pickupTitle}
          onClick={() => onAcknowledgePickup(pickupIds, shelfPickup)}
          className={cn(
            (groupedAcks || pickupAckOnlyToolbar) && panelSegmentLastClass,
            "whitespace-nowrap tabular-nums"
          )}
        >
          {pickupLabel}
        </MyOrderAckButton>
      ) : null}
    </>
  );

  return (
    <div className="flex w-full shrink-0 flex-wrap items-stretch justify-end gap-1.5 sm:w-auto sm:gap-1.5">
      {groupedAcks || pickupAckOnlyToolbar ? (
        <div className={cn(mojeActionBarShellClass, "w-full sm:w-auto")}>{ackButtons}</div>
      ) : (
        ackButtons
      )}
      {overflowMenu}
    </div>
  );
}

export function MyOrderShipmentCard({
  row,
  listKind,
  domId,
  showProgress,
  canAcknowledge,
  pending,
  expanded,
  onToggle,
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
}: {
  row: MyOrderRow;
  listKind: MyOrderListKind;
  domId?: string;
  showProgress: boolean;
  canAcknowledge: boolean;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
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
  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup" ||
    showDismissAck;
  const isUrgent = headlineTone === "warning";
  const isStock = headlineTone === "stock";
  const isInformacja = row.kind === "informacja";

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
  const plannedOrderDate = row.plannedOrderDate ?? null;
  const showExpandedStatusBadge = shouldShowExpandedOrderStatusBadge(row, {
    hasRequestProgress: Boolean(requestProgress),
  });

  const showAllProductLines = linesOpen || searchShowsProductLines;
  const visibleLines = showAllProductLines ? row.lines : row.lines.slice(0, 8);
  const hasClient = Boolean(row.clientLabel || row.lines.some((l) => l.clientName?.trim()));

  const ensureExpanded = () => {
    if (!expanded && needsExpand) onToggle();
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
    onToggle();
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
    if (line.showSalesCancelRemainder) return 1;
    if (line.salesCancelPhase === "in_transit") return 1;
    return line.defaultSalesCancelQuantity ?? 1;
  };

  const showPerLineCancel =
    canAcknowledge &&
    !tourPreview &&
    Boolean(onCancelRequest || onPartialCancelRequest) &&
    (row.lineCount > 1 || Boolean(soleLine?.canCancelBySales));
  const cancelLineLabel = salesCancelLineShortLabel(row.kind);
  const cancelOverflowLabel = salesCancelOverflowLabel(
    row.kind,
    row.salesCancelOrderIds.length
  );

  const soleOverflowRemainder =
    Boolean(soleLine?.canCancelBySales) &&
    Boolean(soleLine?.showSalesCancelRemainder) &&
    soleLine?.defaultSalesCancelQuantity != null;
  const soleOverflowCustom = Boolean(soleLine?.canCancelBySales && soleLine?.canPartialSalesCancel);
  const soleOverflowFull =
    Boolean(showSalesCancelLink) &&
    row.lineCount === 1 &&
    Boolean(soleLine?.canCancelBySales) &&
    !soleOverflowRemainder;

  const overflowMenu = canAcknowledge && !tourPreview ? (
    <MyOrderShipmentOverflowMenu
      supplierName={row.supplierName}
      listKind={row.kind}
      disabled={pending}
      hasClient={hasClient}
      canAssignClient={canEditClient && row.lineCount > 0}
      assignClientLabel={assignClientLabel}
      canEdit={Boolean(showEditLink)}
      canCancel={row.lineCount > 1 ? Boolean(showSalesCancelLink) : soleOverflowFull}
      cancelLabel={row.lineCount > 1 ? cancelOverflowLabel : undefined}
      canPartialCancelRemainder={soleOverflowRemainder}
      partialCancelRemainderLabel={
        soleLine?.defaultSalesCancelQuantity != null
          ? salesCancelLineRemainderLabel(soleLine.defaultSalesCancelQuantity)
          : undefined
      }
      onPartialCancelRemainder={
        soleLine && soleOverflowRemainder
          ? () => openPartialCancel(soleLine, soleLine.defaultSalesCancelQuantity!)
          : undefined
      }
      canPartialCancelCustom={soleOverflowCustom}
      partialCancelCustomLabel={salesCancelLineCustomQtyLabel(soleLine?.salesCancelPhase)}
      onPartialCancelCustom={
        soleLine && soleOverflowCustom
          ? () => openPartialCancel(soleLine, partialCustomDefaultQty(soleLine))
          : undefined
      }
      onAssignClient={handleAssignClient}
      onEdit={() => onEditRequest?.(row)}
      onCancel={() => {
        const cancellableLines = row.lines
          .filter(
            (l) =>
              row.salesCancelOrderIds.includes(l.id) && l.salesCancelPhase
          )
          .map((l) => ({ product: l.product, phase: l.salesCancelPhase! }));
        onCancelRequest?.(row.salesCancelOrderIds, cancellableLines);
      }}
    />
  ) : null;

  const compactPickupOrAvailability =
    compactActionLayout &&
    !expanded &&
    (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") &&
    needsAck;

  const bannerAckInHeadline = showHeadlineBanner && Boolean(showSinglePickup);

  const bannerAction = bannerAckInHeadline ? (
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
  ) : undefined;

  const toolbar = (
    <ShipmentToolbar
      overflowMenu={overflowMenu}
      showSinglePickup={Boolean(showSinglePickup)}
      showBulkPickup={Boolean(showBulkPickup)}
      showDismissAck={Boolean(showDismissAck)}
      hideSinglePickup={bannerAckInHeadline}
      ackMode={ackMode}
      isInformacjaAck={isInformacjaAck}
      dismissAckLabel={dismissAckLabel}
      dismissAckTitle={dismissAckTitle}
      dismissAckIds={dismissAckIds}
      pending={pending}
      pickupIds={row.pickupPendingIds}
      pickupCount={row.pickupPendingCount}
      isAction={isAction}
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
  const hideLineRequestNote = Boolean(sharedRequestNote);
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
    isUrgent && "text-amber-900",
    isStock && "text-sky-900",
    isInformacja &&
      !isAction &&
      !isInformacjaAck &&
      !isUrgent &&
      !isStock &&
      "font-medium text-violet-900",
    headlineTone === "info" &&
      !isAction &&
      !isUrgent &&
      !isStock &&
      !isInformacja &&
      "text-indigo-800",
    !isAction && !isUrgent && !isStock && headlineTone !== "info" && !isInformacja && "text-slate-600"
  );

  const bannerSubline = collapsedSubline;

  return (
    <li
      id={domId}
      className={cn(
        mojeShipmentRowClass({
          expanded,
          isAction,
          isInformacjaAck,
          isUrgent,
          isStock,
          isInformacja,
          visualTone: rowVisualTone,
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
              <MyOrderKindBadge row={row} />
            </div>
            {suppressSharedHeadline ? (
              <span className="sr-only">{headline}</span>
            ) : null}
            {showRowHeadline && (!showHeadlineBanner || compactPickupOrAvailability) ? (
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

        {!expanded ? (
          <div className="hidden min-w-0 max-w-[46%] shrink-0 flex-col items-end gap-1 sm:flex">
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

        <div className={mojeQueueRowActionsClass} onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
      </div>

      {!expanded && (showStatusBadge || productSummary || plannedOrderDate) ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100/80 px-3 pb-1.5 pt-0 sm:hidden">
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
            <MyOrderExpandedDeliveryTiming
              display={expandedDeliveryTiming}
              searchQuery={searchQuery}
            />
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
                    {...lineItemProps(line.id)}
                    canCancelLine={showPerLineCancel}
                    cancelLineLabel={cancelLineLabel}
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
                      className={panelSegmentLastClass}
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
    </li>
  );
}
