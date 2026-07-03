"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  teethPanelHistoryOrderCardClass,
  teethPanelHistoryOrderCardCancelledClass,
  teethPanelHistoryOrderCardDoneClass,
  teethPanelHistoryOrderCardOrderedClass,
  teethPanelHistoryOrderCardPartialClass,
  teethPanelRowActionsClass,
} from "@/lib/teeth/teeth-panel-ui";
import { TEETH_SECTION_LABELS } from "@/lib/teeth/teeth-builder-copy";
import { TeethPanelSpecList } from "@/components/teeth/TeethPanelSpecList";
import { TeethPanelOrderSpec } from "@/components/teeth/TeethPanelOrderSpec";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import {
  orderHasIncompleteTeethSpec,
  orderHasTeethList,
} from "@/lib/teeth/teeth-panel-filters";
import {
  teethPanelReadinessContextFromMaps,
  teethPanelProductLineLabelForOrder,
} from "@/lib/teeth/teeth-panel-order-readiness";
import type { TeethQueueItem } from "@/lib/data/teeth-queue";
import { formatPlDate } from "@/lib/display-labels";
import { IconCalendar, IconChevronLeft } from "@/components/icons/StrokeIcons";
import type { IndividualOrderTeethDetail } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";

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

function historySurfaceClass(item: TeethQueueItem): string {
  if (item.status === "Anulowane" || item.sales_cancelled_at) return teethPanelHistoryOrderCardCancelledClass;
  if (item.status === "Zrealizowane") return teethPanelHistoryOrderCardDoneClass;
  if (item.status === "Czesciowo_zrealizowane") return teethPanelHistoryOrderCardPartialClass;
  return teethPanelHistoryOrderCardOrderedClass;
}

function historyStatusHint(item: TeethQueueItem): string | null {
  if (item.status === "Anulowane" || item.sales_cancelled_at) return "anulowane";
  if (item.status === "Czesciowo_zrealizowane") return "częściowo";
  if (item.status === "Zrealizowane") return "zrealizowane";
  return null;
}

/** Pojedyncze zamówienie w historii — zwarte linijki, bez powtórzeń z nagłówka grupy. */
export function TeethPanelHistoryOrderEntry({
  item,
  onEditDate,
  onUnmark,
}: {
  item: TeethQueueItem;
  onEditDate?: () => void;
  onUnmark?: () => void;
}) {
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );

  const hasList = orderHasTeethList(item);
  const hasIncompleteSpec = orderHasIncompleteTeethSpec(item, readinessCtx);
  const productLineLabel = teethPanelProductLineLabelForOrder(item, readinessCtx);
  const registryKind =
    item.subiekt_tw_id != null && item.subiekt_tw_id > 0
      ? teethProductInfo.kindByTwId.get(Math.trunc(item.subiekt_tw_id))
      : null;
  const kindLabel = registryKind ? TEETH_SECTION_LABELS[registryKind] : null;

  const salesPerson = item.sales_person_name?.trim() || "Handlowiec";
  const qty = parseInt(item.quantity, 10);
  const qtyLabel = Number.isFinite(qty) && qty > 0 ? `${qty} ${plPozycja(qty)}` : null;

  const metaParts: string[] = [];
  if (qtyLabel) metaParts.push(qtyLabel);
  if (item.teeth_ordered_at) {
    metaParts.push(`zam. ${formatPlDate(item.teeth_ordered_at.slice(0, 10))}`);
  }
  if (item.teeth_delivery_date) {
    metaParts.push(`dost. ${formatPlDate(item.teeth_delivery_date)}`);
  }
  const statusHint = historyStatusHint(item);
  if (statusHint) metaParts.push(statusHint);

  const productParts = [productLineLabel, kindLabel].filter(Boolean);

  return (
    <article className={cn(teethPanelHistoryOrderCardClass, historySurfaceClass(item))}>
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className={cn(panelTypography.rowTitle, "text-sm")}>{salesPerson}</span>
              {metaParts.length > 0 ? (
                <span className={cn(panelTypography.caption, "text-slate-500")}>
                  {" "}
                  · {metaParts.join(" · ")}
                </span>
              ) : null}
            </p>
            {productParts.length > 0 ? (
              <p className={cn(panelTypography.caption, "mt-0.5 text-slate-600")}>
                {productParts.join(" · ")}
              </p>
            ) : null}
          </div>

          <div className={cn(teethPanelRowActionsClass, "group/panelRow -mr-1 -mt-0.5")}>
            {onEditDate ? (
              <button
                type="button"
                onClick={onEditDate}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Zmień datę dostawy"
                aria-label="Zmień datę dostawy"
              >
                <IconCalendar size={15} strokeWidth={1.75} />
              </button>
            ) : null}
            {item.status === "Zamowione" && onUnmark ? (
              <button
                type="button"
                onClick={onUnmark}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-800"
                title="Cofnij zamówienie"
                aria-label="Cofnij zamówienie"
              >
                <IconChevronLeft size={15} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </div>

        {hasList ? (
          hasIncompleteSpec ? (
            <TeethPanelOrderSpec details={item.teeth_details ?? null} incomplete />
          ) : (
            <TeethPanelSpecList
              details={toLineDetails(item.teeth_details)}
              layout="lines"
            />
          )
        ) : (
          <TeethPanelOrderSpec details={null} />
        )}

        {item.sales_request_note ? (
          <ProcurementSalesRequestNote note={item.sales_request_note} compact />
        ) : null}
      </div>
    </article>
  );
}
