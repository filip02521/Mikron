"use client";

import { useRouter } from "next/navigation";
import { runAfterScrollUnlock } from "@/lib/ui/page-scroll-lock";
import type { SalesDayStartItem } from "@/lib/sales/sales-day-start";
import { salesDayStartSourceLabel } from "@/lib/sales/sales-day-start";
import { cn } from "@/lib/cn";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
} from "@/lib/ui/moje-shipment-row-styles";
import {
  mojeBrandOutlineControlClass,
  mojeInformacjaAckControlClass,
  mojePickupControlClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";

export function salesDayStartSourceRowAccent(source: SalesDayStartItem["source"]): string {
  switch (source) {
    case "pickup":
    case "zk_warehouse":
      return "border-l-emerald-500 hover:bg-emerald-50/35";
    case "teeth_handover":
      return "border-l-violet-500 hover:bg-violet-50/40";
    case "cancel_ack":
      return "border-l-amber-500 hover:bg-amber-50/50";
    case "informacja_ready":
      return "border-l-violet-400 hover:bg-violet-50/40";
    case "zk_follow_up":
    case "note_follow_up":
      return "border-l-violet-500 hover:bg-violet-50/40";
    case "board_answer":
      return "border-l-sky-500 hover:bg-sky-50/35";
    case "board_announcement":
      return "border-l-sky-600 hover:bg-sky-50/40";
  }
}

function salesDayStartSourceTagClass(source: SalesDayStartItem["source"]): string {
  switch (source) {
    case "pickup":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "teeth_handover":
      return "bg-violet-50 text-violet-800 ring-violet-100";
    case "zk_warehouse":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "cancel_ack":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "informacja_ready":
      return "bg-violet-50 text-violet-800 ring-violet-100";
    case "zk_follow_up":
    case "note_follow_up":
      return "bg-violet-50 text-violet-900 ring-violet-100";
    case "board_answer":
      return "bg-sky-50 text-sky-900 ring-sky-100";
    case "board_announcement":
      return "bg-sky-50 text-sky-950 ring-sky-200/80";
  }
}

function ctaControlClass(item: SalesDayStartItem): string {
  if (
    (item.source === "pickup" ||
      item.source === "teeth_handover" ||
      item.source === "zk_warehouse") &&
    item.ctaLabel === "Potwierdź"
  ) {
    return mojePickupControlClass;
  }
  if (item.source === "informacja_ready" && item.ctaLabel === "Potwierdź") {
    return mojeInformacjaAckControlClass;
  }
  return mojeBrandOutlineControlClass;
}

export function SalesDayStartItemRow({
  item,
  previewHref,
  onNavigate,
  onScrollToSection,
}: {
  item: SalesDayStartItem;
  previewHref: (href: string) => string;
  onNavigate?: () => void;
  onScrollToSection?: (scrollTarget: string, fallbackHref: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    const run = () => {
      if (item.scrollTarget && onScrollToSection) {
        onScrollToSection(item.scrollTarget, item.href);
        return;
      }
      router.push(previewHref(item.href));
    };

    if (onNavigate) {
      onNavigate();
      runAfterScrollUnlock(run);
      return;
    }

    run();
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
          salesDayStartSourceRowAccent(item.source)
        )}
      >
        <div className={mojeQueueRowMainClass}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 ring-1 ring-inset",
                  salesTypography.kindTag,
                  salesDayStartSourceTagClass(item.source)
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
