"use client";

import { useId, useState } from "react";
import type { MyOrderLine, MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { shouldShowOrderStatusBadge } from "@/lib/orders/my-order-card-ui";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";
import {
  myOrderCollapsedMetaFields,
  myOrderCollapsedProductMode,
  myOrderCollapsedSubline,
  myOrderExpandHint,
  myOrderExpandedNotes,
  myOrderNeedsExpand,
  myOrderProductPreviewLine,
} from "@/lib/orders/my-order-row-layout";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { SalesClientNameEditor } from "@/components/moje/SalesClientNameEditor";
import { MyOrderShipmentOverflowMenu } from "@/components/moje/MyOrderShipmentOverflowMenu";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, mojeCardHighlightClass } from "@/lib/ui/ontime-theme";

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={cn(
        "h-4 w-4 transition-transform",
        open ? "rotate-180 text-indigo-700" : "text-slate-500"
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function rowSurfaceClass({
  expanded,
  needsExpand,
  isAction,
  isUrgent,
  isInformacja,
}: {
  expanded: boolean;
  needsExpand: boolean;
  isAction: boolean;
  isUrgent: boolean;
  isInformacja: boolean;
}): string {
  if (expanded && needsExpand) {
    if (isAction) {
      return "z-[1] my-1 rounded-xl border border-emerald-300/90 bg-emerald-50 shadow-md shadow-emerald-100/40 ring-1 ring-emerald-200/70";
    }
    if (isUrgent) {
      return "z-[1] my-1 rounded-xl border border-amber-300/90 bg-amber-50 shadow-md shadow-amber-100/30 ring-1 ring-amber-200/70";
    }
    if (isInformacja) {
      return "z-[1] my-1 rounded-xl border border-violet-300/90 bg-violet-50/95 shadow-md shadow-violet-100/30 ring-1 ring-violet-200/70";
    }
    return mojeCardHighlightClass;
  }
  if (isAction) return "bg-emerald-50/50";
  if (isUrgent) return "bg-amber-50/40";
  if (isInformacja) return "bg-violet-50/40";
  return "bg-white";
}

function MetaInline({
  fields,
  statusLabel,
  statusVariant,
  showStatus,
  lineCount,
}: {
  fields: { label: string; value: string; emphasize?: boolean }[];
  statusLabel?: string;
  statusVariant?: MyOrderRow["badgeVariant"];
  showStatus?: boolean;
  lineCount: number;
}) {
  const hasMeta = fields.length > 0 || showStatus || lineCount > 1;
  if (!hasMeta) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {showStatus && statusLabel ? (
        <MyOrderStatusPill label={statusLabel} variant={statusVariant} />
      ) : null}
      {lineCount > 1 ? (
        <span className="text-[0.65rem] font-medium tabular-nums text-slate-500">
          {lineCount} poz.
        </span>
      ) : null}
      {fields.length > 0 ? (
        <span className="hidden h-3 w-px shrink-0 bg-slate-200 sm:inline-block" aria-hidden />
      ) : null}
      <dl className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] leading-snug">
        {fields.map((f) => (
          <div key={f.label} className="flex min-w-0 items-baseline gap-1">
            <dt className="shrink-0 text-slate-400">{f.label}</dt>
            <dd
              className={cn(
                "min-w-0 truncate font-medium text-slate-700",
                f.emphasize && "text-amber-900"
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProductStrip({
  line,
  showProgress,
  emphasizeStock,
  canEditClient,
  pending,
  openClientEditor,
  onSaveClient,
}: {
  line: MyOrderLine;
  showProgress: boolean;
  emphasizeStock: boolean;
  canEditClient: boolean;
  pending: boolean;
  openClientEditor: boolean;
  onSaveClient?: (orderId: string, name: string | null) => void | Promise<void>;
}) {
  const detail = [line.symbol, line.quantityLabel, showProgress ? line.progressLabel : null]
    .filter(Boolean)
    .join(" · ");

  const onStock = line.stockStatus === "on_stock";
  const partial = line.stockStatus === "partial";

  return (
    <div
      className={cn(
        "mt-2 rounded-lg bg-white/90 px-2.5 py-2 ring-1 ring-slate-200/80",
        emphasizeStock && onStock && "ring-emerald-200/90",
        emphasizeStock && partial && "ring-amber-200/80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-slate-900">{line.product}</p>
          {detail ? (
            <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
          ) : null}
        </div>
        {emphasizeStock && onStock ? (
          <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-emerald-800">
            ✓ U nas
          </span>
        ) : null}
        {emphasizeStock && partial ? (
          <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-900">
            Częściowo
          </span>
        ) : null}
      </div>
      {canEditClient && onSaveClient && openClientEditor ? (
        <SalesClientNameEditor
          value={line.clientName}
          disabled={pending}
          openOnMount
          onSave={(name) => onSaveClient(line.id, name)}
        />
      ) : null}
    </div>
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
    <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:min-w-[7.5rem] sm:items-end">
      <div className="flex items-center justify-end gap-1">
        {overflowMenu}
      </div>
      {showSinglePickup ? (
        <MyOrderAckButton
          variant={isAction ? "action" : "inline"}
          disabled={pending}
          title={ackFullTitle}
          onClick={() => onAcknowledgePickup(pickupIds)}
          className="w-full sm:w-auto"
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
          className="w-full whitespace-nowrap sm:w-auto"
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
  const showEditLink =
    canAcknowledge && row.canEditBySales && onEditRequest && row.supplierId;
  const showStatusBadge = shouldShowOrderStatusBadge(row);
  const canEditClient = canAcknowledge && Boolean(onSaveClient);

  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability";
  const isUrgent = headlineTone === "warning" || isAction;
  const isInformacja = listKind === "informacja" || row.kind === "informacja";

  const emphasizeStock =
    showProgress &&
    row.lines.some((l) => l.stockStatus === "on_stock" || l.stockStatus === "partial") &&
    (row.lines.some((l) => l.stockStatus === "waiting") || row.lineCount === 1);

  const expandCtx = { listKind, showGroupPickup };
  const needsExpand = myOrderNeedsExpand(row, expandCtx);
  const isCompact = !needsExpand;
  const collapsedSubline = myOrderCollapsedSubline(row);
  const expandedNotes = myOrderExpandedNotes(row);
  const collapsedMeta = myOrderCollapsedMetaFields(row, showProgress);
  const expandHint = myOrderExpandHint(row, expandCtx);
  const productPeekMode = myOrderCollapsedProductMode(row, listKind);
  const surfaceClass = rowSurfaceClass({
    expanded,
    needsExpand,
    isAction,
    isUrgent,
    isInformacja,
  });

  const visibleLines = linesOpen ? row.lines : row.lines.slice(0, 8);
  const hasClient = Boolean(row.clientLabel || row.lines.some((l) => l.clientName?.trim()));
  const singleLine = row.lineCount === 1 ? row.lines[0] : null;

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

  const showProductStrip = isCompact && singleLine && productPeekMode === "full";

  const mainContent = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3
          className={cn(
            "truncate text-[0.95rem] text-slate-900",
            expanded && needsExpand ? "font-semibold" : "font-medium"
          )}
        >
          {row.supplierName}
        </h3>
        <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
          {kindLabel}
        </span>
        {expanded && needsExpand ? (
          <span className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
            Szczegóły
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-0.5 text-[0.8125rem] font-medium leading-snug",
          isAction && "text-emerald-800",
          !isAction && isUrgent && "text-amber-900",
          !isAction && !isUrgent && "text-slate-700"
        )}
      >
        {headline}
      </p>

      {collapsedSubline ? (
        <p
          className={cn(
            "mt-1 text-[0.7rem] leading-snug",
            isAction ? "text-emerald-800/90" : "text-slate-600"
          )}
        >
          {collapsedSubline}
        </p>
      ) : null}

      <MetaInline
        fields={collapsedMeta}
        statusLabel={row.statusTitle}
        statusVariant={row.badgeVariant}
        showStatus={showStatusBadge}
        lineCount={row.lineCount}
      />

      {showProductStrip && singleLine ? (
        <ProductStrip
          line={singleLine}
          showProgress={showProgress}
          emphasizeStock={emphasizeStock}
          canEditClient={canEditClient}
          pending={pending}
          openClientEditor={clientEditorLineId === singleLine.id}
          onSaveClient={onSaveClient}
        />
      ) : null}

      {!expanded && !showProductStrip && row.lineCount > 0 ? (
        <p className="mt-2 truncate text-xs text-slate-600">
          {productPeekMode === "summary" ? (
            <span className="font-medium text-slate-700">{myOrderProductPreviewLine(row)}</span>
          ) : null}
          {productPeekMode === "full" && row.lineCount > 1 ? (
            <span className="font-medium text-slate-700">{myOrderProductPreviewLine(row)}</span>
          ) : null}
        </p>
      ) : null}

      {needsExpand && !expanded ? (
        <p className={cn("mt-1.5 text-[0.65rem] font-medium opacity-80", brandLinkSubtleClass)}>
          {expandHint}
        </p>
      ) : null}
    </div>
  );

  const expandedPanel = (
    <div
      id={panelId}
      className={cn(
        "border-t border-slate-200/60 px-3 pb-2.5 pt-2 sm:px-3.5",
        isInformacja && "border-violet-200/50"
      )}
    >
      {expandedNotes ? (
        <p className="mb-2 rounded-lg bg-white/70 px-2.5 py-2 text-[0.7rem] leading-relaxed text-slate-600 ring-1 ring-slate-200/60">
          {expandedNotes}
        </p>
      ) : null}

      {row.lineCount > 0 ? (
        <div className="rounded-lg bg-white/70 ring-1 ring-slate-200/70">
          {row.lineCount > 1 ? (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5">
              <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500">
                Pozycje ({row.lineCount})
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
          ) : null}
          {emphasizeStock ? (
            <p className="border-b border-slate-100 px-2.5 py-1 text-[0.65rem] text-emerald-800">
              Zielony pasek — na magazynie
            </p>
          ) : null}
          <ul className="divide-y divide-slate-100 px-1">
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
        <div className="mt-2 flex justify-end">
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
  );

  return (
    <li
      id={domId}
      className={cn(
        "border-b border-slate-200/60 transition-[background-color,box-shadow] duration-150 last:border-b-0",
        surfaceClass
      )}
    >
      <div className="flex items-start gap-1 px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3">
        {needsExpand ? (
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-indigo-700",
              expanded && "bg-white/90 text-indigo-700 ring-1 ring-indigo-200/80"
            )}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? "Zwiń" : expandHint}: ${row.supplierName}`}
          >
            <ChevronIcon open={expanded} />
          </button>
        ) : (
          <span className="mt-1.5 w-0 shrink-0 sm:w-2" aria-hidden />
        )}

        {mainContent}
        {toolbar}
      </div>

      {needsExpand && expanded ? expandedPanel : null}

      {!showProductStrip && clientEditorLineId && singleLine ? (
        <div className="border-t border-slate-200/60 px-3 pb-2.5 pt-0 sm:px-3.5">
          <ProductStrip
            line={singleLine}
            showProgress={showProgress}
            emphasizeStock={emphasizeStock}
            canEditClient={canEditClient}
            pending={pending}
            openClientEditor
            onSaveClient={onSaveClient}
          />
        </div>
      ) : null}
    </li>
  );
}
