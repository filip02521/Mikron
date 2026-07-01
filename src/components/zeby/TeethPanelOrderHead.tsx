"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { Badge } from "@/components/ui/Badge";
import { TeethProductLineBadge } from "@/components/teeth/TeethProductLineBadge";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog";
import { formatPlDate } from "@/lib/display-labels";

export function TeethPanelOrderHead({
  title,
  quantity,
  productLineLabel,
  productLine,
  kindLabel,
  productMeta,
  variant,
  orderedAt,
  deliveryDate,
  statusBadge,
  trailing,
  issueBadges,
}: {
  /** Zwykle handlowiec lub nazwa towaru przy pojedynczej pozycji bez handlowca. */
  title: string;
  quantity?: string | null;
  productLineLabel?: string | null;
  productLine?: TeethProductLine | null;
  kindLabel?: string | null;
  productMeta?: string | null;
  variant: "queue" | "history";
  orderedAt?: string | null;
  deliveryDate?: string | null;
  statusBadge?: ReactNode;
  trailing?: ReactNode;
  issueBadges?: ReactNode;
}) {
  const qty = quantity?.trim();
  const historyDates: string[] = [];
  if (variant === "history") {
    if (orderedAt) historyDates.push(`Zamówiono ${formatPlDate(orderedAt.slice(0, 10))}`);
    if (deliveryDate) historyDates.push(`Dostawa ${formatPlDate(deliveryDate)}`);
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className={panelTypography.rowTitle}>{title}</h3>
          {qty ? (
            <span className="text-sm font-normal tabular-nums text-slate-500">× {qty}</span>
          ) : null}
        </div>

        {(productLineLabel || kindLabel) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {productLineLabel ? (
              <TeethProductLineBadge label={productLineLabel} productLine={productLine} />
            ) : null}
            {kindLabel ? (
              <Badge variant="default" className="rounded-md px-1.5 py-0 text-[10px]">
                {kindLabel}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {productMeta ? (
          <p className={cn(panelTypography.rowMeta, "text-slate-600")}>{productMeta}</p>
        ) : null}

        {historyDates.length > 0 ? (
          <p className={cn(panelTypography.caption, "text-slate-500")}>
            {historyDates.join(" · ")}
          </p>
        ) : null}

        {issueBadges ? (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">{issueBadges}</div>
        ) : null}

        {statusBadge && variant === "history" && !issueBadges ? (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">{statusBadge}</div>
        ) : null}
      </div>

      {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
    </div>
  );
}
