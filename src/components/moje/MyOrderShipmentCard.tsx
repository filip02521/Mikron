"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { shouldShowOrderStatusBadge } from "@/lib/orders/my-order-card-ui";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";
import {
  myOrderCollapsedProductSummary,
  myOrderCollapsedSubline,
  myOrderExpandHint,
  myOrderExpandedNotes,
  myOrderNeedsExpand,
} from "@/lib/orders/my-order-row-layout";
import { myOrderMetaFields } from "@/lib/orders/my-order-sales-ui";
import { myOrderFriendlyStatusHint } from "@/lib/orders/my-order-friendly-status";
import { MyOrderExpandedMeta } from "@/components/moje/MyOrderExpandedMeta";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { MyOrderShipmentOverflowMenu } from "@/components/moje/MyOrderShipmentOverflowMenu";
import { MyOrderHeadlineBanner } from "@/components/moje/MyOrderHeadlineBanner";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";
import {
  mojeShipmentExpandedActionsClass,
  mojeShipmentExpandedClientsClass,
  mojeShipmentExpandedNotesClass,
  mojeShipmentExpandedPanelClass,
  mojeShipmentLinesHeaderClass,
  mojeShipmentLinesHeaderTitleClass,
  mojeShipmentLinesShellClass,
  mojeShipmentRowClass,
} from "@/lib/ui/moje-shipment-row-styles";
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
  ackShortLabel,
  ackFullTitle,
  dismissAckLabel,
  dismissAckTitle,
  dismissAckIds,
  pending,
  pickupIds,
  pickupCount,
  isAction,
  onAcknowledgePickup,
  onAcknowledgeDismiss,
  tourPreview = false,
}: {
  overflowMenu: React.ReactNode;
  showSinglePickup: boolean;
  showBulkPickup: boolean;
  showDismissAck: boolean;
  hideSinglePickup?: boolean;
  ackShortLabel: string;
  ackFullTitle: string;
  dismissAckLabel: string;
  dismissAckTitle: string;
  dismissAckIds: string[];
  pending: boolean;
  pickupIds: string[];
  pickupCount: number;
  isAction: boolean;
  onAcknowledgePickup: (ids: string[]) => void;
  onAcknowledgeDismiss: (ids: string[]) => void;
  tourPreview?: boolean;
}) {
  const hasToolbar =
    overflowMenu ||
    showDismissAck ||
    showBulkPickup ||
    (showSinglePickup && !hideSinglePickup);
  if (!hasToolbar) return null;

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      {overflowMenu}
      {showDismissAck ? (
        <MyOrderAckButton
          variant={isAction ? "action" : "inline"}
          disabled={pending}
          preview={tourPreview}
          title={dismissAckTitle}
          onClick={() => onAcknowledgeDismiss(dismissAckIds)}
        >
          {dismissAckLabel}
        </MyOrderAckButton>
      ) : null}
      {showSinglePickup && !hideSinglePickup ? (
        <MyOrderAckButton
          variant={isAction ? "action" : "inline"}
          disabled={pending}
          preview={tourPreview}
          title={ackFullTitle}
          onClick={() => onAcknowledgePickup(pickupIds)}
        >
          {ackShortLabel}
        </MyOrderAckButton>
      ) : null}
      {showBulkPickup ? (
        <MyOrderAckButton
          variant={isAction ? "action" : "inline"}
          disabled={pending}
          preview={tourPreview}
          title={ackFullTitle}
          onClick={() => onAcknowledgePickup(pickupIds)}
          className="whitespace-nowrap"
        >
          {pickupCount} do odbioru
        </MyOrderAckButton>
      ) : null}
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
  onSaveClient,
  onEditRequest,
  searchQuery,
  tourPreview = false,
}: {
  row: MyOrderRow;
  listKind: MyOrderListKind;
  domId?: string;
  showProgress: boolean;
  canAcknowledge: boolean;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledgePickup: (orderIds: string[]) => void;
  onAcknowledgeCancelled?: (orderIds: string[]) => void;
  onAcknowledgeCancelNotice?: (orderIds: string[]) => void;
  onCancelRequest?: (orderIds: string[], phase: SalesCancelPhase) => void;
  onSaveClient?: (orderId: string, name: string | null) => void | Promise<void>;
  onEditRequest?: (row: MyOrderRow) => void;
  searchQuery?: string | null;
  tourPreview?: boolean;
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

  const ackShortLabel =
    row.acknowledgeMode === "availability" ? "Potwierdź" : "Potwierdź odbiór";
  const ackFullTitle =
    row.acknowledgeMode === "availability"
      ? "Potwierdzam, że widziałem/am powiadomienie o dostępności"
      : "Potwierdzam odbiór towaru z magazynu";

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

  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability" ||
    showDismissAck;
  const isUrgent = headlineTone === "warning";
  const isInformacja = listKind === "informacja" || row.kind === "informacja";

  const emphasizeStock =
    showProgress &&
    row.lines.some((l) => l.stockStatus === "on_stock" || l.stockStatus === "partial") &&
    (row.lines.some((l) => l.stockStatus === "waiting") || row.lineCount === 1);

  const expandCtx = { listKind, showGroupPickup };
  const needsExpand = myOrderNeedsExpand(row, expandCtx);
  const collapsedSubline = myOrderCollapsedSubline(row);
  const expandedNotes = myOrderExpandedNotes(row);
  const expandedMeta = myOrderMetaFields(row, showProgress).filter(
    (f) => !(f.label === "Klient" && canEditClient)
  );
  const expandHint = myOrderExpandHint(row, expandCtx);
  const productSummary = myOrderCollapsedProductSummary(row, listKind);

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

  const overflowMenu = canAcknowledge && !tourPreview ? (
    <MyOrderShipmentOverflowMenu
      supplierName={row.supplierName}
      listKind={listKind}
      disabled={pending}
      hasClient={hasClient}
      canAssignClient={canEditClient && row.lineCount > 0}
      assignClientLabel={assignClientLabel}
      canEdit={Boolean(showEditLink)}
      canCancel={Boolean(showSalesCancelLink)}
      onAssignClient={handleAssignClient}
      onEdit={() => onEditRequest?.(row)}
      onCancel={() =>
        onCancelRequest?.(row.salesCancelOrderIds, row.salesCancelPhase!)
      }
    />
  ) : null;

  const kindShort = row.kind === "informacja" ? "Info." : "Zam.";
  const statusHint = myOrderFriendlyStatusHint(row.statusTitle);

  const showHeadlineBanner =
    !expanded &&
    (headlineTone === "action" ||
      headlineTone === "warning" ||
      headlineTone === "success" ||
      isAction ||
      isUrgent);

  const bannerAckInHeadline = showHeadlineBanner && Boolean(showSinglePickup);

  const bannerAction = bannerAckInHeadline ? (
    <MyOrderAckButton
      variant="banner"
      disabled={pending}
      preview={tourPreview}
      title={ackFullTitle}
      ariaLabel={ackFullTitle}
      onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
    >
      {ackShortLabel}
    </MyOrderAckButton>
  ) : undefined;

  const toolbar = (
    <ShipmentToolbar
      overflowMenu={overflowMenu}
      showSinglePickup={Boolean(showSinglePickup)}
      showBulkPickup={Boolean(showBulkPickup)}
      showDismissAck={Boolean(showDismissAck)}
      hideSinglePickup={bannerAckInHeadline}
      ackShortLabel={ackShortLabel}
      ackFullTitle={ackFullTitle}
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
    />
  );

  const hideLineClient =
    row.lineCount === 1 && Boolean(row.clientLabel) && !canEditClient;

  const lineItemProps = (lineId: string) => ({
    showProgress,
    emphasizeStock,
    compact: true,
    hideClientLabel: hideLineClient,
    canAcknowledge: showGroupPickup,
    pending,
    acknowledgeLineLabel: "Potwierdź" as const,
    acknowledgeLineTitle: ackFullTitle,
    onAcknowledgePickup: showGroupPickup
      ? (id: string) => onAcknowledgePickup([id])
      : undefined,
    canEditClient,
    onSaveClient: onSaveClient
      ? async (orderId: string, name: string | null) => {
          await onSaveClient(orderId, name);
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
    "truncate text-xs font-medium sm:text-[0.8125rem]",
    isAction && "text-emerald-800",
    isUrgent && "text-amber-900",
    !isAction && !isUrgent && "text-slate-600"
  );

  const bannerSubline =
    collapsedSubline && statusHint
      ? `${collapsedSubline} · ${statusHint}`
      : collapsedSubline ?? statusHint;

  return (
    <li
      id={domId}
      className={mojeShipmentRowClass({ expanded, isAction, isUrgent, isInformacja })}
    >
      {showHeadlineBanner ? (
        <MyOrderHeadlineBanner
          headline={headline}
          subline={bannerSubline}
          tone={headlineTone}
          action={bannerAction}
        />
      ) : null}
      <div className="flex min-h-[2.75rem] items-center gap-1 px-2 py-1.5 sm:min-h-[3rem] sm:gap-2 sm:px-3 sm:py-2">
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
            "flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 sm:h-8 sm:w-8",
            needsExpand && "hover:bg-slate-100 hover:text-indigo-700"
          )}
        >
          {needsExpand ? <ChevronIcon open={expanded} /> : null}
        </button>

        <button
          type="button"
          onClick={handleToggle}
          disabled={!needsExpand}
          className={cn(
            "min-w-0 flex-1 text-left",
            needsExpand &&
              "hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-300"
          )}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <SearchHighlightText
              text={row.supplierName}
              searchQuery={searchQuery}
              className="truncate text-sm font-semibold text-slate-900"
            />
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                isInformacja
                  ? "bg-violet-100 text-violet-800"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {kindShort}
            </span>
          </div>
          {!showHeadlineBanner ? (
            <SearchHighlightText
              text={headline}
              searchQuery={searchQuery}
              className={headlineClass}
              as="p"
            />
          ) : null}
          {!showHeadlineBanner && !expanded && collapsedSubline ? (
            <SearchHighlightText
              text={collapsedSubline}
              searchQuery={searchQuery}
              className="mt-0.5 truncate text-[0.68rem] leading-snug text-slate-500"
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
        </button>

        {!expanded ? (
          <div className="hidden min-w-0 max-w-[46%] shrink-0 flex-col items-end gap-1 sm:flex">
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
                className="text-[0.65rem] font-medium tabular-nums text-slate-500"
              />
            ) : null}
          </div>
        ) : null}

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
      </div>

      {!expanded && (showStatusBadge || productSummary) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100/80 px-3 pb-1.5 pt-0 sm:hidden">
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
              className="text-[0.65rem] font-medium text-slate-500"
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
          {(showStatusBadge || expandedNotes) && (
            <div className="space-y-2">
              {showStatusBadge ? (
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

          {row.lineCount > 1 && row.clientLabel ? (
            <p className={mojeShipmentExpandedClientsClass}>
              <span className="font-semibold text-slate-700">Klienci przy produktach: </span>
              <SearchHighlightText
                text={row.clientLabel}
                searchQuery={searchQuery}
                className="font-medium text-slate-800"
              />
            </p>
          ) : null}

          {row.lineCount > 0 ? (
            <div className={mojeShipmentLinesShellClass}>
              <div className={mojeShipmentLinesHeaderClass}>
                <p className={mojeShipmentLinesHeaderTitleClass}>
                  {row.lineCount > 1 ? productSummary ?? "Produkty" : "Produkt"}
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
                  <MyOrderAckButton
                    variant="action"
                    disabled={pending}
                    preview={tourPreview}
                    title={ackFullTitle}
                    ariaLabel={ackFullTitle}
                    onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
                  >
                    {row.acknowledgeMode === "availability"
                      ? `Potwierdź wszystkie (${row.pickupPendingCount})`
                      : `Odbiór wszystkich (${row.pickupPendingCount})`}
                  </MyOrderAckButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
