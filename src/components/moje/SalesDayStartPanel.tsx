"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  SalesDayStartItem,
  SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import {
  salesDayStartPanelDescription,
  salesDayStartSourceLabel,
  sliceSalesDayStartItems,
} from "@/lib/sales/sales-day-start";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun } from "@/components/icons/StrokeIcons";
import { SalesDayStartHelp } from "@/components/moje/SalesDayStartHelp";
import { cn } from "@/lib/cn";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
  mojeShipmentListClass,
} from "@/lib/ui/moje-shipment-row-styles";
import {
  brandLinkClass,
  mojeBrandOutlineControlClass,
  mojeInformacjaAckControlClass,
  mojePickupControlClass,
  salesChromeInsetClass,
  salesTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";

function sourceRowAccent(source: SalesDayStartItem["source"]): string {
  switch (source) {
    case "pickup":
      return "border-l-emerald-500 hover:bg-emerald-50/35";
    case "cancel_ack":
      return "border-l-amber-500 hover:bg-amber-50/50";
    case "informacja_ready":
      return "border-l-violet-400 hover:bg-violet-50/40";
    case "zk_follow_up":
    case "note_follow_up":
      return "border-l-violet-500 hover:bg-violet-50/40";
    case "board_answer":
    case "board_announcement":
      return "border-l-sky-500 hover:bg-sky-50/35";
  }
}

function sourceTagClass(source: SalesDayStartItem["source"]): string {
  switch (source) {
    case "pickup":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "cancel_ack":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "informacja_ready":
      return "bg-violet-50 text-violet-800 ring-violet-100";
    case "zk_follow_up":
    case "note_follow_up":
      return "bg-violet-50 text-violet-900 ring-violet-100";
    default:
      return "bg-sky-50 text-sky-900 ring-sky-100";
  }
}

function ctaControlClass(item: SalesDayStartItem): string {
  if (item.source === "pickup" && item.ctaLabel === "Potwierdź") {
    return mojePickupControlClass;
  }
  if (item.source === "informacja_ready" && item.ctaLabel === "Potwierdź") {
    return mojeInformacjaAckControlClass;
  }
  return mojeBrandOutlineControlClass;
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
          mojeQueueRowLayoutClass,
          "w-full border-l-[3px] bg-white px-3 py-2.5 text-left transition-colors duration-150 sm:px-4 sm:py-3",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500/40",
          sourceRowAccent(item.source)
        )}
      >
        <div className={mojeQueueRowMainClass}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 ring-1 ring-inset",
                  salesTypography.kindTag,
                  sourceTagClass(item.source)
                )}
              >
                {salesDayStartSourceLabel(item.source)}
              </span>
              <span className={cn("min-w-0 truncate", salesTypography.rowTitle)}>{item.title}</span>
            </div>
            {item.subtitle ? (
              <p className={cn("mt-0.5 line-clamp-2 sm:truncate", salesTypography.rowBody)}>
                {item.subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className={cn(mojeQueueRowActionsClass, "sm:self-center")}>
          <span className={cn("pointer-events-none w-full sm:w-auto", ctaControlClass(item))}>
            {item.ctaLabel}
          </span>
        </div>
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
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const previewHref = (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  if (snapshot.cleared) return null;

  const { visible: visibleItems, hiddenCount } = sliceSalesDayStartItems(
    snapshot.items,
    itemsExpanded
  );

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
            <IconSun size={20} />
          </SectionHeadingIcon>
        }
        title="Start dnia"
        description={salesDayStartPanelDescription(snapshot.totalActionCount)}
        action={<SalesDayStartHelp />}
      />

      <div className={cn("pb-3", salesChromeInsetClass)}>
        <ul
          className={cn(
            mojeShipmentListClass,
            "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm"
          )}
        >
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
            className={cn("mt-2.5 text-xs font-semibold", brandLinkClass)}
          >
            Pokaż jeszcze {hiddenCount}{" "}
            {hiddenCount === 1 ? "zadanie" : hiddenCount < 5 ? "zadania" : "zadań"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
