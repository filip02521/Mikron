"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { checkboxBrandClass, panelTypography } from "@/lib/ui/ontime-theme";
import {
  teethPanelOrderRowClass,
  teethPanelOrderRowCompactClass,
  teethPanelOrderRowSelectedClass,
  teethPanelRowActionsClass,
  teethPanelEditLinkClass,
} from "@/lib/teeth/teeth-panel-ui";
import { compactTeethProductLabel } from "@/lib/teeth/teeth-panel-display";
import { groupTeethDetails } from "@/lib/teeth/teeth-catalog";
import { Badge } from "@/components/ui/Badge";
import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";
import { TeethPanelOrderSpec } from "@/components/teeth/TeethPanelOrderSpec";
import { TeethPanelEditOrderTrigger } from "@/components/zeby/TeethPanelEditOrderTrigger";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { orderHasIncompleteTeethSpec, orderHasTeethList, orderHasTeethSpec } from "@/lib/teeth/teeth-panel-filters";
import { teethPanelReadinessContextFromMaps, type TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import type { TeethQueueItem } from "@/lib/data/teeth-queue";
import { formatPlDate } from "@/lib/display-labels";
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

function TeethPanelOrderMeta({
  item,
  variant,
  compact,
  issuesOnly,
  readinessCtx,
}: {
  item: TeethQueueItem;
  variant: "queue" | "history";
  compact?: boolean;
  issuesOnly?: boolean;
  readinessCtx?: TeethPanelReadinessContext;
}) {
  const showMissingList = !orderHasTeethSpec(item, readinessCtx) && !orderHasIncompleteTeethSpec(item, readinessCtx);
  const showIncomplete = orderHasIncompleteTeethSpec(item, readinessCtx);
  const showVerification = variant === "queue" && item.status === "Weryfikacja";
  const showInformacja = variant === "queue" && item.request_kind === "informacja";

  if (issuesOnly && !showMissingList && !showIncomplete && !showVerification && !showInformacja) {
    return null;
  }

  if (compact || issuesOnly) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {showInformacja ? (
          <Badge variant="default" className="text-[10px]">
            Informacja
          </Badge>
        ) : null}
        {showVerification ? (
          <Badge variant="warning" className="text-[10px]">
            Weryfikacja
          </Badge>
        ) : null}
        {showMissingList ? (
          <Badge variant="warning" className="text-[10px]">
            Brak listy
          </Badge>
        ) : null}
        {showIncomplete ? (
          <Badge variant="warning" className="text-[10px]">
            Lista niekompletna
          </Badge>
        ) : null}
        {variant === "history" ? (
          <Badge variant="default" className="text-[10px]">
            {item.status === "Zrealizowane"
              ? "Zrealizowane"
              : item.status === "Czesciowo_zrealizowane"
                ? "Częściowo"
                : "Zamówione"}
          </Badge>
        ) : null}
      </div>
    );
  }

  const metaParts: string[] = [];

  if (variant === "queue") {
    metaParts.push(`Ilość: ${item.quantity}`);
  }

  if (item.sales_person_name) {
    metaParts.push(item.sales_person_name);
  }

  if (variant === "history" && item.teeth_ordered_at) {
    metaParts.push(`Zamówiono ${formatPlDate(item.teeth_ordered_at.slice(0, 10))}`);
  }

  if (variant === "history" && item.teeth_delivery_date) {
    metaParts.push(`Dostawa ${formatPlDate(item.teeth_delivery_date)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {metaParts.length > 0 ? (
        <p className={panelTypography.rowMeta}>{metaParts.join(" · ")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {variant === "queue" && item.request_kind === "informacja" ? (
          <Badge variant="default" className="text-[10px]">
            Informacja
          </Badge>
        ) : null}
        {variant === "queue" && item.status === "Weryfikacja" ? (
          <Badge variant="warning" className="text-[10px]">
            Weryfikacja
          </Badge>
        ) : null}
        {!orderHasTeethSpec(item, readinessCtx) && !orderHasIncompleteTeethSpec(item, readinessCtx) ? (
          <Badge variant="warning" className="text-[10px]">
            Brak listy
          </Badge>
        ) : null}
        {orderHasIncompleteTeethSpec(item, readinessCtx) ? (
          <Badge variant="warning" className="text-[10px]">
            Lista niekompletna
          </Badge>
        ) : null}
        {variant === "history" ? (
          <Badge variant="default" className="text-[10px]">
            {item.status === "Zrealizowane"
              ? "Zrealizowane"
              : item.status === "Czesciowo_zrealizowane"
                ? "Częściowo"
                : "Zamówione"}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function TeethPanelBatchOrderBody({
  item,
  variant,
  readinessCtx,
}: {
  item: TeethQueueItem;
  variant: "queue" | "history";
  readinessCtx?: TeethPanelReadinessContext;
}) {
  const hasList = orderHasTeethList(item);
  const hasIncompleteSpec = orderHasIncompleteTeethSpec(item, readinessCtx);
  const groups = groupTeethDetails(toLineDetails(item.teeth_details));

  if (!hasList) {
    return (
      <p className="text-xs text-amber-800" role="status">
        Brak listy zębów — uzupełnij przed zamówieniem u dostawcy.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {hasIncompleteSpec ? (
        <p className="text-xs text-amber-800" role="status">
          Lista niekompletna — uzupełnij kolor, fason, szczękę i typ przy każdej sztuce.
        </p>
      ) : null}
      {groups.length > 0 ? (
        <TeethGroupChips groups={groups} compact variant="panel" />
      ) : null}
      {variant === "history" && (item.teeth_ordered_at || item.teeth_delivery_date) ? (
        <p className={panelTypography.caption}>
          {item.teeth_ordered_at
            ? `Zamówiono ${formatPlDate(item.teeth_ordered_at.slice(0, 10))}`
            : null}
          {item.teeth_ordered_at && item.teeth_delivery_date ? " · " : null}
          {item.teeth_delivery_date
            ? `Dostawa ${formatPlDate(item.teeth_delivery_date)}`
            : null}
        </p>
      ) : null}
    </div>
  );
}

export function TeethPanelOrderEntry({
  item,
  variant,
  mergedBatch,
  supplierName,
  checked,
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
  const showVerification = item.status === "Weryfikacja";
  const productLabel = compactTeethProductLabel(
    item.products,
    item.symbol,
    supplierName ?? item.supplier_name,
  );

  if (mergedBatch) {
    const showProductLine = !hasSpec || showVerification || hasIncompleteSpec || !hasList;
    const showQuantity = !hasSpec;

    return (
      <article
        className={cn(
          teethPanelOrderRowCompactClass,
          variant === "queue" && checked && teethPanelOrderRowSelectedClass,
        )}
      >
        <div className="flex gap-2.5 sm:gap-3">
          {variant === "queue" && onToggleSelect ? (
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggleSelect}
              className={cn(checkboxBrandClass, "mt-0.5 shrink-0")}
              aria-label={`Zaznacz prośbę: ${item.sales_person_name ?? item.products}`}
            />
          ) : null}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className={panelTypography.rowTitle}>
                  {item.sales_person_name ?? "Handlowiec"}
                  {showQuantity ? (
                    <span className="ml-1.5 text-sm font-normal tabular-nums text-slate-500">
                      × {item.quantity}
                    </span>
                  ) : null}
                </h3>
                {showProductLine ? (
                  <p className={panelTypography.rowMeta}>
                    {productLabel.primary}
                    {productLabel.secondary ? (
                      <span className="text-slate-400"> · {productLabel.secondary}</span>
                    ) : null}
                  </p>
                ) : null}
                <TeethPanelOrderMeta
                  item={item}
                  variant={variant}
                  compact
                  issuesOnly
                  readinessCtx={readinessCtx}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {variant === "queue" && onEditSaved ? (
                  <TeethPanelEditOrderTrigger
                    orderId={item.id}
                    onSaved={onEditSaved}
                    className={teethPanelEditLinkClass}
                  />
                ) : null}
                {variant === "history" ? (
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
                ) : null}
              </div>
            </div>

            <TeethPanelBatchOrderBody item={item} variant={variant} readinessCtx={readinessCtx} />

            {item.sales_request_note ? (
              <ProcurementSalesRequestNote note={item.sales_request_note} compact />
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        teethPanelOrderRowClass,
        variant === "queue" && checked && teethPanelOrderRowSelectedClass,
      )}
    >
      <div className="flex gap-3">
        {variant === "queue" && onToggleSelect ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelect}
            className={cn(checkboxBrandClass, "mt-1 shrink-0")}
            aria-label={`Zaznacz: ${item.products}`}
          />
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className={panelTypography.rowTitle}>{item.products}</h3>
                {item.symbol && item.symbol !== "-" ? (
                  <span className={cn(panelTypography.rowMeta, "font-medium text-slate-600")}>
                    {item.symbol}
                  </span>
                ) : null}
              </div>
              <TeethPanelOrderMeta item={item} variant={variant} readinessCtx={readinessCtx} />
            </div>

            {variant === "history" ? (
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
                    title="Cofnij zamówienie — wróci do kolejki"
                    aria-label="Cofnij zamówienie"
                  >
                    <IconChevronLeft size={16} strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {item.sales_request_note ? (
            <ProcurementSalesRequestNote note={item.sales_request_note} compact />
          ) : null}

          <TeethPanelOrderSpec
            details={hasList ? (item.teeth_details ?? null) : null}
            incomplete={hasIncompleteSpec}
          />

          {variant === "queue" && onEditSaved ? (
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
