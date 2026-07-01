"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import {
  teethPanelOrderRowClass,
  teethPanelOrderRowCompactClass,
  teethPanelOrderRowDoneClass,
  teethPanelOrderRowIssueClass,
  teethPanelOrderRowOrderedClass,
  teethPanelOrderRowReadyClass,
  teethPanelOrderRowSelectedClass,
  teethPanelRowActionsClass,
  teethPanelEditLinkClass,
  teethPanelSpecInsetClass,
} from "@/lib/teeth/teeth-panel-ui";
import { compactTeethProductLabel } from "@/lib/teeth/teeth-panel-display";
import { TEETH_SECTION_LABELS } from "@/lib/teeth/teeth-builder-copy";
import { Badge } from "@/components/ui/Badge";
import { TeethPanelSpecList } from "@/components/teeth/TeethPanelSpecList";
import { TeethPanelOrderSpec } from "@/components/teeth/TeethPanelOrderSpec";
import { TeethPanelOrderHead } from "@/components/zeby/TeethPanelOrderHead";
import { TeethPanelEditOrderTrigger } from "@/components/zeby/TeethPanelEditOrderTrigger";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import {
  orderHasIncompleteTeethSpec,
  orderHasTeethList,
  orderHasTeethSpec,
} from "@/lib/teeth/teeth-panel-filters";
import { TEETH_QUEUE_HEADER_DATA_LABEL, teethQueueOrderNeedsHeaderData } from "@/lib/teeth/teeth-queue-gate";
import {
  teethPanelReadinessContextFromMaps,
  teethPanelProductLineLabelForOrder,
  resolveTeethProductLineForPanelOrder,
  type TeethPanelReadinessContext,
} from "@/lib/teeth/teeth-panel-order-readiness";
import type { TeethQueueItem } from "@/lib/data/teeth-queue";
import { IconCalendar, IconChevronLeft } from "@/components/icons/StrokeIcons";
import type { IndividualOrderTeethDetail } from "@/types/database";

function toLineDetails(details: IndividualOrderTeethDetail[] | null | undefined) {
  if (!details?.length) return [];
  return details.map((d) => ({
    position: d.position,
    color: d.color,
    mould: d.mould,
    jaw: d.jaw,
    kind: d.kind,
  }));
}

function historyStatusLabel(item: TeethQueueItem): string {
  if (item.status === "Zrealizowane") return "Zrealizowane";
  if (item.status === "Czesciowo_zrealizowane") return "Częściowo";
  return "Zamówione";
}

function buildIssueBadges(
  item: TeethQueueItem,
  variant: "queue" | "history",
  readinessCtx: TeethPanelReadinessContext,
) {
  const badges: ReactNode[] = [];
  const showMissingList =
    !orderHasTeethSpec(item, readinessCtx) && !orderHasIncompleteTeethSpec(item, readinessCtx);
  const showIncomplete = orderHasIncompleteTeethSpec(item, readinessCtx);
  const needsHeaderData = variant === "queue" && teethQueueOrderNeedsHeaderData(item);

  if (variant === "queue" && item.request_kind === "informacja") {
    badges.push(
      <Badge key="info" variant="default" className="text-[10px]">
        Informacja
      </Badge>,
    );
  }
  if (needsHeaderData) {
    badges.push(
      <Badge key="header" variant="warning" className="text-[10px]">
        {TEETH_QUEUE_HEADER_DATA_LABEL}
      </Badge>,
    );
  }
  if (showMissingList) {
    badges.push(
      <Badge key="missing" variant="warning" className="text-[10px]">
        Brak listy
      </Badge>,
    );
  }
  if (showIncomplete) {
    badges.push(
      <Badge key="incomplete" variant="warning" className="text-[10px]">
        Lista niekompletna
      </Badge>,
    );
  }
  if (variant === "history") {
    badges.push(
      <Badge key="status" variant="default" className="text-[10px]">
        {historyStatusLabel(item)}
      </Badge>,
    );
  }
  return badges.length > 0 ? badges : null;
}

function orderRowSurfaceClass(
  variant: "queue" | "history",
  hasQueueIssue: boolean,
  hasSpec: boolean,
  item: TeethQueueItem,
  checked: boolean,
  compact: boolean,
): string {
  const base = compact ? teethPanelOrderRowCompactClass : teethPanelOrderRowClass;
  const selected = variant === "queue" && checked ? teethPanelOrderRowSelectedClass : "";

  if (variant === "queue") {
    if (hasQueueIssue) return cn(base, teethPanelOrderRowIssueClass, selected);
    if (hasSpec) return cn(base, teethPanelOrderRowReadyClass, selected);
    return cn(base, selected);
  }

  if (item.status === "Zrealizowane") {
    return cn(base, teethPanelOrderRowDoneClass, selected);
  }
  return cn(base, teethPanelOrderRowOrderedClass, selected);
}

function HistoryActions({
  item,
  onEditDate,
  onUnmark,
}: {
  item: TeethQueueItem;
  onEditDate?: () => void;
  onUnmark?: () => void;
}) {
  return (
    <div className={teethPanelRowActionsClass}>
      {onEditDate ? (
        <button
          type="button"
          onClick={onEditDate}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Zmień datę dostawy"
          aria-label="Zmień datę dostawy"
        >
          <IconCalendar size={16} strokeWidth={1.75} />
        </button>
      ) : null}
      {item.status === "Zamowione" && onUnmark ? (
        <button
          type="button"
          onClick={onUnmark}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-800"
          title="Cofnij zamówienie"
          aria-label="Cofnij zamówienie"
        >
          <IconChevronLeft size={16} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

export function TeethPanelOrderEntry({
  item,
  variant,
  mergedBatch,
  supplierName,
  checked = false,
  specIncludedInBatch = false,
  onToggleSelect,
  onEditSaved,
  onEditDate,
  onUnmark,
}: {
  item: TeethQueueItem;
  variant: "queue" | "history";
  mergedBatch?: boolean;
  supplierName?: string | null;
  checked?: boolean;
  /** Kompletna specyfikacja jest w podsumowaniu grupy — nie powtarzaj tabeli. */
  specIncludedInBatch?: boolean;
  onToggleSelect?: () => void;
  onEditSaved?: (message?: string) => void;
  onEditDate?: () => void;
  onUnmark?: () => void;
}) {
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );

  const hasList = orderHasTeethList(item);
  const hasSpec = orderHasTeethSpec(item, readinessCtx);
  const hasIncompleteSpec = orderHasIncompleteTeethSpec(item, readinessCtx);
  const needsHeaderData = variant === "queue" && teethQueueOrderNeedsHeaderData(item);
  const hasQueueIssue =
    variant === "queue" && (!hasSpec || hasIncompleteSpec || !hasList || needsHeaderData);

  const productLabel = compactTeethProductLabel(
    item.products,
    item.symbol,
    supplierName ?? item.supplier_name,
  );
  const productLine = resolveTeethProductLineForPanelOrder(item, readinessCtx);
  const productLineLabel = teethPanelProductLineLabelForOrder(item, readinessCtx);
  const registryKind =
    item.subiekt_tw_id != null && item.subiekt_tw_id > 0
      ? teethProductInfo.kindByTwId.get(Math.trunc(item.subiekt_tw_id))
      : null;
  const kindBadgeLabel = registryKind ? TEETH_SECTION_LABELS[registryKind] : null;

  const title = item.sales_person_name ?? productLineLabel ?? item.products;
  const productMeta =
    productLineLabel && productLabel.primary
      ? [productLabel.primary, productLabel.secondary].filter(Boolean).join(" · ")
      : item.symbol && item.symbol !== "-"
        ? productLabel.primary
        : null;

  const issueBadges = buildIssueBadges(item, variant, readinessCtx);
  const includeSpecInBatch =
    specIncludedInBatch && hasSpec && !hasIncompleteSpec && hasList;
  const showInlineSpecInBatch =
    mergedBatch && hasList && (hasIncompleteSpec || !includeSpecInBatch);

  const rowClass = orderRowSurfaceClass(
    variant,
    hasQueueIssue,
    hasSpec,
    item,
    checked,
    Boolean(mergedBatch),
  );

  const headTrailing =
    variant === "history" ? (
      <HistoryActions item={item} onEditDate={onEditDate} onUnmark={onUnmark} />
    ) : mergedBatch && onEditSaved ? (
      <TeethPanelEditOrderTrigger
        orderId={item.id}
        onSaved={onEditSaved}
        className={teethPanelEditLinkClass}
      />
    ) : null;

  return (
    <article className={rowClass}>
      <div className={cn("flex", mergedBatch ? "gap-2.5 sm:gap-3" : "gap-3")}>
        {variant === "queue" && onToggleSelect ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelect}
            className={cn(checkboxBrandClass, mergedBatch ? "mt-0.5" : "mt-1", "shrink-0")}
            aria-label={`Zaznacz: ${title}`}
          />
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <TeethPanelOrderHead
            title={title}
            quantity={variant === "queue" || !mergedBatch ? item.quantity : null}
            productLineLabel={productLineLabel}
            productLine={productLine}
            kindLabel={kindBadgeLabel}
            productMeta={productMeta || undefined}
            variant={variant}
            orderedAt={item.teeth_ordered_at}
            deliveryDate={item.teeth_delivery_date}
            issueBadges={issueBadges}
            trailing={headTrailing}
          />

          {item.sales_request_note ? (
            <ProcurementSalesRequestNote note={item.sales_request_note} compact />
          ) : null}

          {mergedBatch ? (
            <>
              {!hasList ? (
                <p className="text-xs text-amber-800" role="status">
                  Brak listy zębów — uzupełnij przed zamówieniem u dostawcy.
                </p>
              ) : null}
              {showInlineSpecInBatch ? (
                hasIncompleteSpec ? (
                  <TeethPanelOrderSpec
                    details={item.teeth_details ?? null}
                    incomplete
                  />
                ) : (
                  <TeethPanelSpecList
                    details={toLineDetails(item.teeth_details)}
                    className={teethPanelSpecInsetClass}
                    compact
                  />
                )
              ) : includeSpecInBatch ? (
                <TeethPanelOrderSpec
                  details={item.teeth_details ?? null}
                  specIncludedInBatch
                />
              ) : null}
            </>
          ) : (
            <TeethPanelOrderSpec
              details={hasList ? (item.teeth_details ?? null) : null}
              incomplete={hasIncompleteSpec}
              specIncludedInBatch={includeSpecInBatch}
            />
          )}

          {variant === "queue" && onEditSaved && !mergedBatch ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <TeethPanelEditOrderTrigger
                orderId={item.id}
                onSaved={onEditSaved}
                className={teethPanelEditLinkClass}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
