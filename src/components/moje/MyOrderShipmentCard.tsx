"use client";

import { useId, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import {
  shouldShowOrderStatusBadge,
  shouldShowOrderStatusDetail,
} from "@/lib/orders/my-order-card-ui";
import { myOrderMetaFields } from "@/lib/orders/my-order-sales-ui";
import { MyOrderHeadlineBanner } from "@/components/moje/MyOrderHeadlineBanner";
import { MyOrderLineItem } from "@/components/moje/MyOrderLineItem";
import { SalesCancelRequestLink } from "@/components/moje/SalesCancelRequestLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function productPreview(row: MyOrderRow): string {
  if (row.lineCount <= 1) {
    const line = row.lines[0];
    if (!line) return row.product;
    return line.symbol ? `${line.product} · ${line.symbol}` : line.product;
  }
  const first = row.lines[0]?.product ?? row.product;
  const n = row.lineCount - 1;
  const more = n === 1 ? "1 inny produkt" : n < 5 ? `${n} inne produkty` : `${n} innych produktów`;
  return `${first} + ${more}`;
}

export function MyOrderShipmentCard({
  row,
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
  const hasDetails = Boolean(
    row.statusDetail || row.lineCount > 0 || row.timingLabel
  );

  const visibleLines = linesOpen ? row.lines : row.lines.slice(0, 5);
  const hasArrived = row.lines.some(
    (l) => l.stockStatus === "on_stock" || l.stockStatus === "partial"
  );
  const hasWaiting = row.lines.some((l) => l.stockStatus === "waiting");
  const emphasizeStock = showProgress && hasArrived && (hasWaiting || row.lineCount === 1);

  const headline = row.headline ?? row.statusTitle;
  const headlineTone = row.headlineTone ?? "neutral";
  const metaFields = myOrderMetaFields(row, showProgress);
  const showStatusBadge = shouldShowOrderStatusBadge(row);
  const showStatusDetail = shouldShowOrderStatusDetail(row);

  const showSinglePickup =
    canAcknowledge &&
    row.acknowledgeMode === "pickup" &&
    row.lineCount === 1 &&
    row.lines[0]?.canAcknowledgePickup;
  const showGroupPickup =
    canAcknowledge && row.acknowledgeMode === "pickup" && row.lineCount > 1;
  const showBulkPickup =
    showGroupPickup && row.pickupPendingCount > 0 && row.pickupPendingIds.length > 0;

  const showSalesCancelLink =
    canAcknowledge &&
    row.canCancelBySales &&
    row.salesCancelPhase &&
    onCancelRequest;

  const showEditLink =
    canAcknowledge && row.canEditBySales && onEditRequest && row.supplierId;

  const pickupActionBar = showSinglePickup || showBulkPickup;
  const isActionCard = row.headlineTone === "action" || row.acknowledgeMode === "pickup";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-shadow",
        expanded && "ring-1 ring-indigo-100",
        isActionCard && "border-emerald-300 ring-1 ring-emerald-100",
        !isActionCard && "border-slate-200/90"
      )}
    >
      <MyOrderHeadlineBanner
        headline={headline}
        subline={row.subline}
        tone={headlineTone}
      />

      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left hover:bg-slate-50/80 active:bg-slate-100/80"
        aria-expanded={expanded}
        aria-controls={hasDetails ? panelId : undefined}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <span className="truncate text-base font-semibold text-slate-900">
              {row.supplierName}
            </span>
            {showStatusBadge ? (
              <Badge variant={row.badgeVariant} className="shrink-0 text-[10px]">
                {row.statusTitle}
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm text-slate-700 sm:line-clamp-1">
            {productPreview(row)}
          </p>
          {metaFields.length > 0 ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {metaFields.map((f) => (
                <div key={f.label} className="flex gap-1.5">
                  <dt className="text-slate-400">{f.label}</dt>
                  <dd
                    className={cn(
                      "font-medium tabular-nums",
                      f.emphasize ? "text-slate-900" : "text-slate-600"
                    )}
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {hasDetails ? (
          <span
            className={cn(
              "mt-1 shrink-0 text-slate-400 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        ) : null}
      </button>

      {pickupActionBar && !expanded ? (
        <div className="border-t border-slate-100 bg-white px-3.5 py-3 space-y-2">
          {showSinglePickup ? (
            <Button
              size="lg"
              className="w-full min-h-11"
              disabled={pending}
              onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
            >
              Potwierdzam odbiór z magazynu
            </Button>
          ) : null}
          {showBulkPickup ? (
            <>
              <Button
                size="lg"
                className="w-full min-h-11"
                disabled={pending}
                onClick={() => onAcknowledgePickup(row.pickupPendingIds)}
              >
                Potwierdzam odbiór wszystkich gotowych ({row.pickupPendingCount})
              </Button>
              <p className="text-center text-[11px] text-slate-500">
                Rozwiń kartę, aby odebrać wybrane pozycje z listy produktów
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {expanded && hasDetails ? (
        <div
          id={panelId}
          className="border-t border-slate-100 bg-white px-3.5 py-3 text-sm"
        >
          {showStatusDetail ? (
            <p className="mb-3 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/60">
              {row.statusDetail}
            </p>
          ) : null}

          {row.lineCount > 0 ? (
            <div>
              <ProductsHeader
                lineCount={row.lineCount}
                linesOpen={linesOpen}
                onToggleLines={() => setLinesOpen((v) => !v)}
              />
              {emphasizeStock ? (
                <p className="mb-2 text-xs font-medium text-emerald-800">
                  Zielone pozycje są już na magazynie — możesz je odebrać. Szare czekają w
                  tej samej dostawie.
                </p>
              ) : null}
              <ul className="space-y-2">
                {visibleLines.map((line, i) => (
                  <MyOrderLineItem
                    key={line.id}
                    line={line}
                    index={i}
                    showProgress={showProgress}
                    emphasizeStock={emphasizeStock}
                    canAcknowledge={showGroupPickup}
                    pending={pending}
                    onAcknowledgePickup={
                      showGroupPickup ? (id) => onAcknowledgePickup([id]) : undefined
                    }
                    canEditClient={canAcknowledge && Boolean(onSaveClient)}
                    onSaveClient={onSaveClient}
                  />
                ))}
              </ul>
              {!linesOpen && row.lineCount > 5 ? (
                <p className="mt-2 text-xs text-slate-500">
                  … i jeszcze {row.lineCount - 5} pozycji
                </p>
              ) : null}
            </div>
          ) : null}

          {showEditLink ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onEditRequest(row)}
              className="mt-3 text-sm font-medium text-slate-500 underline decoration-slate-200 underline-offset-2 hover:text-slate-800"
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
      ) : null}
    </article>
  );
}

function ProductsHeader({
  lineCount,
  linesOpen,
  onToggleLines,
}: {
  lineCount: number;
  linesOpen: boolean;
  onToggleLines: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Produkty w dostawie ({lineCount})
      </p>
      {lineCount > 5 ? (
        <button
          type="button"
          onClick={onToggleLines}
          className="min-h-9 px-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          {linesOpen ? "Zwiń listę" : "Pokaż wszystkie"}
        </button>
      ) : null}
    </div>
  );
}
