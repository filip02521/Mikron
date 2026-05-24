"use client";

import { useId, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import {
  shouldShowOrderStatusBadge,
  shouldShowOrderStatusDetail,
} from "@/lib/orders/my-order-card-ui";
import { myOrderMetaFields } from "@/lib/orders/my-order-sales-ui";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { SalesCancelRequestLink } from "@/components/moje/SalesCancelRequestLink";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={cn(
        "h-4 w-4 shrink-0 text-slate-400 transition-transform",
        open && "rotate-180"
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

function productPreview(row: MyOrderRow): string {
  if (row.lineCount <= 1) {
    const line = row.lines[0];
    if (!line) return row.product;
    return line.symbol ? `${line.product} · ${line.symbol}` : line.product;
  }
  const first = row.lines[0]?.product ?? row.product;
  const n = row.lineCount - 1;
  const more = n === 1 ? "+1 poz." : `+${n} poz.`;
  return `${first} ${more}`;
}

function collapsedMetaLine(row: MyOrderRow, showProgress: boolean): string | null {
  const fields = myOrderMetaFields(row, showProgress);
  const parts = fields
    .filter((f) => f.label !== "Zgłoszono" || fields.length <= 2)
    .slice(0, 3)
    .map((f) => `${f.value}`);
  if (!parts.length) return null;
  return parts.join(" · ");
}

export function MyOrderShipmentCard({
  row,
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
  const headline = row.headline ?? row.statusTitle;
  const headlineTone = row.headlineTone ?? "neutral";
  const metaLine = collapsedMetaLine(row, showProgress);
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
    showGroupPickup && row.pickupPendingCount > 0 && row.pickupPendingIds.length > 0;

  const showSalesCancelLink =
    canAcknowledge &&
    row.canCancelBySales &&
    row.salesCancelPhase &&
    onCancelRequest;
  const showEditLink =
    canAcknowledge && row.canEditBySales && onEditRequest && row.supplierId;
  const showStatusBadge = shouldShowOrderStatusBadge(row);
  const showStatusDetail = shouldShowOrderStatusDetail(row);

  const isAction =
    headlineTone === "action" ||
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability";
  const isUrgent = headlineTone === "warning" || isAction;

  const visibleLines = linesOpen ? row.lines : row.lines.slice(0, 5);
  const emphasizeStock =
    showProgress &&
    row.lines.some((l) => l.stockStatus === "on_stock" || l.stockStatus === "partial") &&
    (row.lines.some((l) => l.stockStatus === "waiting") || row.lineCount === 1);

  return (
    <li
      id={domId}
      className={cn(
        "border-b border-slate-200/70 transition-[background-color,box-shadow,margin] duration-200 last:border-b-0",
        expanded &&
          "z-[1] mx-1.5 my-2 rounded-xl border shadow-md last:border-b",
        expanded && isAction && "border-emerald-200/90 bg-emerald-50/75 shadow-emerald-100/50 ring-1 ring-emerald-100",
        expanded && !isAction && isUrgent && "border-amber-200/90 bg-amber-50/60 shadow-amber-100/40 ring-1 ring-amber-100",
        expanded && !isAction && !isUrgent && "border-indigo-200/90 bg-indigo-50/80 shadow-indigo-100/50 ring-1 ring-indigo-100",
        !expanded && isAction && "bg-emerald-50/35",
        !expanded && !isAction && isUrgent && "bg-amber-50/25"
      )}
    >
      <div className={cn("flex items-stretch", expanded && "rounded-t-xl border-b border-slate-200/50")}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3",
            expanded && isAction && "hover:bg-emerald-100/40",
            expanded && !isAction && "hover:bg-indigo-100/45",
            !expanded && "hover:bg-white/80"
          )}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${expanded ? "Zwiń" : "Rozwiń"}: ${row.supplierName}`}
        >
          <ChevronIcon open={expanded} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "truncate text-slate-900",
                  expanded ? "font-semibold" : "font-medium"
                )}
              >
                {row.supplierName}
              </span>
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
                {kindLabel}
              </span>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-sm font-medium leading-snug",
                isAction && "text-emerald-800",
                !isAction && isUrgent && "text-amber-900",
                !isAction && !isUrgent && "text-slate-700"
              )}
            >
              {headline}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-600 sm:hidden">
              {productPreview(row)}
            </p>
            {metaLine ? (
              <p className="mt-0.5 truncate text-[0.7rem] text-slate-500 sm:hidden">
                {metaLine}
              </p>
            ) : null}
          </div>
          <div className="hidden max-w-[12rem] shrink-0 text-right sm:block">
            <p className="truncate text-xs text-slate-600">{productPreview(row)}</p>
            {metaLine ? (
              <p className="mt-0.5 truncate text-[0.7rem] text-slate-500">{metaLine}</p>
            ) : null}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end justify-center gap-1 self-stretch py-2 pr-2 sm:pr-3">
          {showSinglePickup && !expanded ? (
            <MyOrderAckButton
              variant="inline"
              disabled={pending}
              title={ackFullTitle}
              onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
            >
              {ackShortLabel}
            </MyOrderAckButton>
          ) : null}
          {showBulkPickup && !expanded ? (
            <MyOrderAckButton
              variant="inline"
              disabled={pending}
              title={ackFullTitle}
              onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
            >
              {row.pickupPendingCount} do odbioru
            </MyOrderAckButton>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1">
            {showStatusBadge ? (
              <Badge variant={row.badgeVariant} className="text-[10px]">
                {row.statusTitle}
              </Badge>
            ) : null}
            {row.lineCount > 1 ? (
              <Badge variant="default" className="tabular-nums text-[10px]">
                {row.lineCount} poz.
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div
          id={panelId}
          className={cn(
            "rounded-b-xl border-t px-3 pb-3 pt-2 sm:px-4 sm:pb-3.5",
            isAction && "border-emerald-200/40 bg-emerald-100/20",
            !isAction && "border-indigo-200/40 bg-indigo-100/25"
          )}
        >
          <div className="rounded-lg border border-slate-200/80 bg-white/95 p-3 shadow-sm">
            {row.subline ? (
              <p
                className={cn(
                  "mb-2.5 border-b pb-2.5 text-xs leading-snug",
                  isAction ? "border-emerald-100 text-emerald-900" : "border-slate-100 text-slate-600"
                )}
              >
                {row.subline}
              </p>
            ) : null}

            {showStatusDetail ? (
              <p className="mb-2.5 text-xs leading-relaxed text-slate-600">{row.statusDetail}</p>
            ) : null}

            {row.lineCount > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Produkty ({row.lineCount})
                  </p>
                  {row.lineCount > 5 ? (
                    <button
                      type="button"
                      onClick={() => setLinesOpen((v) => !v)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {linesOpen ? "Zwiń" : "Wszystkie"}
                    </button>
                  ) : null}
                </div>
                {emphasizeStock ? (
                  <p className="mb-2 text-[0.7rem] font-medium text-emerald-800">
                    Zielone — na magazynie; szare — jeszcze w dostawie.
                  </p>
                ) : null}
                <ul className="space-y-1.5">
                  {visibleLines.map((line, i) => (
                    <MyOrderLineItem
                      key={line.id}
                      line={line}
                      index={i}
                      showProgress={showProgress}
                      emphasizeStock={emphasizeStock}
                      canAcknowledge={showGroupPickup}
                      pending={pending}
                      acknowledgeLineLabel="Potwierdź"
                      acknowledgeLineTitle={ackFullTitle}
                      onAcknowledgePickup={
                        showGroupPickup ? (id) => onAcknowledgePickup([id]) : undefined
                      }
                      canEditClient={canAcknowledge && Boolean(onSaveClient)}
                      onSaveClient={onSaveClient}
                    />
                  ))}
                </ul>
                {!linesOpen && row.lineCount > 5 ? (
                  <p className="mt-1.5 text-xs text-slate-500">
                    … i jeszcze {row.lineCount - 5} pozycji
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2.5 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
              {showGroupPickup && row.pickupPendingIds.length ? (
                <MyOrderAckButton
                  variant="inline"
                  disabled={pending}
                  title={ackFullTitle}
                  onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
                >
                  {row.acknowledgeMode === "availability"
                    ? `Potwierdź wszystkie (${row.pickupPendingCount})`
                    : `Odbiór wszystkich (${row.pickupPendingCount})`}
                </MyOrderAckButton>
              ) : null}
              {showEditLink ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onEditRequest(row)}
                  className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Popraw prośbę
                </button>
              ) : null}
              {showSalesCancelLink ? (
                <SalesCancelRequestLink
                  disabled={pending}
                  onClick={() =>
                    onCancelRequest(row.salesCancelOrderIds, row.salesCancelPhase!)
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
