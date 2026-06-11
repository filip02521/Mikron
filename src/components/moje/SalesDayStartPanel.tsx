"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  SalesDayStartItem,
  SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import {
  salesDayStartSourceLabel,
  sliceSalesDayStartItems,
} from "@/lib/sales/sales-day-start";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { brandLinkClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

function sourceTone(source: SalesDayStartItem["source"]): string {
  switch (source) {
    case "pickup":
      return "border-emerald-200/90 bg-emerald-50/70";
    case "cancel_ack":
    case "informacja_ready":
      return "border-indigo-200/80 bg-indigo-50/50";
    case "zk_follow_up":
    case "note_follow_up":
      return "border-violet-200/80 bg-violet-50/50";
    case "board_answer":
    case "board_announcement":
      return "border-sky-200/80 bg-sky-50/50";
  }
}

function sourceBadgeVariant(source: SalesDayStartItem["source"]) {
  switch (source) {
    case "pickup":
      return "success" as const;
    case "cancel_ack":
    case "informacja_ready":
      return "info" as const;
    case "zk_follow_up":
    case "note_follow_up":
      return "purple" as const;
    default:
      return "default" as const;
  }
}

function DayStartItemRow({
  item,
  previewHref,
  onScrollToSection,
}: {
  item: SalesDayStartItem;
  previewHref: (href: string) => string;
  onScrollToSection?: (scrollTarget: string, fallbackHref: string) => void;
}) {
  const router = useRouter();
  const tone = sourceTone(item.source);

  const handleClick = () => {
    if (item.scrollTarget && onScrollToSection) {
      onScrollToSection(item.scrollTarget, item.href);
      return;
    }
    router.push(previewHref(item.href));
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left shadow-sm transition",
          "hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
          tone
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sourceBadgeVariant(item.source)} className="text-[10px]">
              {salesDayStartSourceLabel(item.source)}
            </Badge>
            <span className={cn("truncate", salesTypography.rowTitle, "text-sm")}>
              {item.title}
            </span>
          </div>
          {item.subtitle ? (
            <p className={cn("mt-0.5 truncate", salesTypography.rowBody)}>{item.subtitle}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-indigo-700">
          {item.ctaLabel}
          <LinkChevron size={14} tone="brand" />
        </span>
      </button>
    </li>
  );
}

export function SalesDayStartPanel({
  snapshot,
  onScrollToSection,
}: {
  snapshot: SalesDayStartSnapshot;
  onScrollToSection?: (scrollTarget: string, fallbackHref: string) => void;
}) {
  if (snapshot.cleared) return null;

  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const previewHref = (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla);

  const [itemsExpanded, setItemsExpanded] = useState(false);

  const { visible: visibleItems, hiddenCount } = sliceSalesDayStartItems(
    snapshot.items,
    itemsExpanded
  );

  return (
    <Card padding={false} className="overflow-hidden border-indigo-200/60">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
            <IconSun size={20} />
          </SectionHeadingIcon>
        }
        title="Start dnia"
        description={
          snapshot.totalActionCount === 1
            ? "1 rzecz wymaga reakcji — od najpilniejszych."
            : `${snapshot.totalActionCount} rzeczy wymaga reakcji — od najpilniejszych.`
        }
      />

      <div className={cn("pb-3", salesChromeInsetClass)}>
        <ul className="flex flex-col gap-1.5">
          {visibleItems.map((item) => (
            <DayStartItemRow
              key={item.id}
              item={item}
              previewHref={previewHref}
              onScrollToSection={onScrollToSection}
            />
          ))}
        </ul>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setItemsExpanded(true)}
            className={cn("mt-2 text-xs font-semibold", brandLinkClass)}
          >
            Pokaż jeszcze {hiddenCount}{" "}
            {hiddenCount === 1 ? "zadanie" : hiddenCount < 5 ? "zadania" : "zadań"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
