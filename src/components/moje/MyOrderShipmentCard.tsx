"use client";

import { useId, useState } from "react";
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
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { MyOrderShipmentOverflowMenu } from "@/components/moje/MyOrderShipmentOverflowMenu";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";
import {
  mojeShipmentExpandedPanelClass,
  mojeShipmentLinesListClass,
  mojeShipmentRowClass,
} from "@/lib/ui/moje-shipment-row-styles";

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

function MetaGrid({
  fields,
}: {
  fields: { label: string; value: string; emphasize?: boolean }[];
}) {
  if (!fields.length) return null;

  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="flex min-w-0 gap-2">
          <dt className="w-16 shrink-0 text-slate-400">{f.label}</dt>
          <dd
            className={cn(
              "min-w-0 font-medium text-slate-800",
              f.emphasize && "text-amber-900"
            )}
          >
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ShipmentToolbar({
  overflowMenu,
  showSinglePickup,
  showBulkPickup,
  ackShortLabel,
  ackFullTitle,
  pending,
  pickupIds,
  pickupCount,
  isAction,
  onAcknowledgePickup,
}: {
  overflowMenu: React.ReactNode;
  showSinglePickup: boolean;
  showBulkPickup: boolean;
  ackShortLabel: string;
  ackFullTitle: string;
  pending: boolean;
  pickupIds: string[];
  pickupCount: number;
  isAction: boolean;
  onAcknowledgePickup: (ids: string[]) => void;
}) {
  const hasToolbar = overflowMenu || showSinglePickup || showBulkPickup;
  if (!hasToolbar) return null;

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      {overflowMenu}
      {showSinglePickup ? (
        <MyOrderAckButton
          variant={isAction ? "action" : "inline"}
          disabled={pending}
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
  onCancelRequest,
  onSaveClient,
  onEditRequest,
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
  onCancelRequest?: (orderIds: string[], phase: SalesCancelPhase) => void;
  onSaveClient?: (orderId: string, name: string | null) => void | Promise<void>;
  onEditRequest?: (row: MyOrderRow) => void;
}) {
  const panelId = useId();
  const [linesOpen, setLinesOpen] = useState(false);
  const [clientEditorLineId, setClientEditorLineId] = useState<string | null>(null);

  const headline = row.headline ?? row.statusTitle;
  const headlineTone = row.headlineTone ?? "neutral";
  const kindLabel = row.kind === "informacja" ? "Informacja" : "Zamówienie";

  const needsAck =
    row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability";
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
    row.canCancelBySales &&
    row.salesCancelPhase &&
    onCancelRequest;
  const showEditLink = canAcknowledge && row.canEditBySales && onEditRequest;
  const showStatusBadge = shouldShowOrderStatusBadge(row);
  const canEditClient = canAcknowledge && Boolean(onSaveClient);

  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability";
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
  const expandedMeta = myOrderMetaFields(row, showProgress);
  const expandHint = myOrderExpandHint(row, expandCtx);
  const productSummary = myOrderCollapsedProductSummary(row, listKind);

  const visibleLines = linesOpen ? row.lines : row.lines.slice(0, 8);
  const hasClient = Boolean(row.clientLabel || row.lines.some((l) => l.clientName?.trim()));

  const ensureExpanded = () => {
    if (!expanded && needsExpand) onToggle();
  };

  const handleAssignClient = () => {
    const target = row.lines.find((l) => !l.clientName?.trim()) ?? row.lines[0];
    if (!target) return;
    ensureExpanded();
    setClientEditorLineId(target.id);
  };

  const handleToggle = () => {
    if (!needsExpand) return;
    if (expanded) setClientEditorLineId(null);
    onToggle();
  };

  const overflowMenu = canAcknowledge ? (
    <MyOrderShipmentOverflowMenu
      supplierName={row.supplierName}
      listKind={listKind}
      disabled={pending}
      hasClient={hasClient}
      canAssignClient={canEditClient && row.lineCount > 0}
      canEdit={Boolean(showEditLink)}
      canCancel={Boolean(showSalesCancelLink)}
      onAssignClient={handleAssignClient}
      onEdit={() => onEditRequest?.(row)}
      onCancel={() =>
        onCancelRequest?.(row.salesCancelOrderIds, row.salesCancelPhase!)
      }
    />
  ) : null;

  const toolbar = (
    <ShipmentToolbar
      overflowMenu={overflowMenu}
      showSinglePickup={Boolean(showSinglePickup)}
      showBulkPickup={Boolean(showBulkPickup)}
      ackShortLabel={ackShortLabel}
      ackFullTitle={ackFullTitle}
      pending={pending}
      pickupIds={row.pickupPendingIds}
      pickupCount={row.pickupPendingCount}
      isAction={isAction}
      onAcknowledgePickup={onAcknowledgePickup}
    />
  );

  const lineItemProps = (lineId: string) => ({
    showProgress,
    emphasizeStock,
    compact: true,
    canAcknowledge: showGroupPickup,
    pending,
    acknowledgeLineLabel: "Potwierdź" as const,
    acknowledgeLineTitle: ackFullTitle,
    onAcknowledgePickup: showGroupPickup
      ? (id: string) => onAcknowledgePickup([id])
      : undefined,
    canEditClient,
    onSaveClient,
    openClientEditor: clientEditorLineId === lineId,
  });

  const headlineClass = cn(
    "truncate text-xs font-medium sm:text-[0.8125rem]",
    isAction && "text-emerald-800",
    isUrgent && "text-amber-900",
    !isAction && !isUrgent && "text-slate-600"
  );

  return (
    <li
      id={domId}
      className={mojeShipmentRowClass({ expanded, isAction, isUrgent, isInformacja })}
    >
      <div className="flex min-h-[2.75rem] items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
        <button
          type="button"
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
            "flex h-8 w-8 shrink-0 items-center justify-center text-slate-500",
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
            <span className="truncate text-sm font-semibold text-slate-900">
              {row.supplierName}
            </span>
            <span className="hidden shrink-0 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
              {kindLabel}
            </span>
          </div>
          <p className={headlineClass}>{headline}</p>
          {!expanded && collapsedSubline ? (
            <p className="mt-0.5 truncate text-[0.68rem] leading-snug text-slate-500">
              {collapsedSubline}
            </p>
          ) : null}
        </button>

        {!expanded ? (
          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            {showStatusBadge ? (
              <MyOrderStatusPill label={row.statusTitle} variant={row.badgeVariant} />
            ) : null}
            {productSummary ? (
              <span className="text-[0.65rem] font-medium tabular-nums text-slate-500">
                {productSummary}
              </span>
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
            <MyOrderStatusPill label={row.statusTitle} variant={row.badgeVariant} />
          ) : null}
          {productSummary ? (
            <span className="text-[0.65rem] font-medium text-slate-500">{productSummary}</span>
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
          {expandedNotes ? (
            <p className="mb-2.5 text-xs leading-relaxed text-slate-600">{expandedNotes}</p>
          ) : null}

          <MetaGrid fields={expandedMeta} />

          {row.clientLabel ? (
            <p className="mt-2 text-xs text-slate-600">
              <span className="text-slate-400">Klient: </span>
              <span className="font-medium text-slate-800">{row.clientLabel}</span>
            </p>
          ) : null}

          {row.lineCount > 0 ? (
            <div className={mojeShipmentLinesListClass}>
              <div className="flex items-center justify-between gap-2 px-0.5 pb-1 pt-0.5">
                <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500">
                  {row.lineCount > 1 ? productSummary : "Towar"}
                </p>
                {row.lineCount > 8 ? (
                  <button
                    type="button"
                    onClick={() => setLinesOpen((v) => !v)}
                    className={cn("text-[0.7rem] font-medium", brandLinkSubtleClass)}
                  >
                    {linesOpen ? "Zwiń" : "Wszystkie"}
                  </button>
                ) : null}
              </div>
              <ul>
                {(row.lineCount > 8 ? visibleLines : row.lines).map((line, i) => (
                  <MyOrderLineItem
                    key={line.id}
                    line={line}
                    index={i}
                    {...lineItemProps(line.id)}
                  />
                ))}
              </ul>
              {!linesOpen && row.lineCount > 8 ? (
                <p className="border-t border-slate-100 px-2.5 py-1 text-[0.7rem] text-slate-500">
                  … +{row.lineCount - 8} poz.
                </p>
              ) : null}
            </div>
          ) : null}

          {showGroupPickup && row.pickupPendingIds.length ? (
            <div className="mt-2.5 flex justify-end">
              <MyOrderAckButton
                variant="action"
                disabled={pending}
                title={ackFullTitle}
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
    </li>
  );
}
