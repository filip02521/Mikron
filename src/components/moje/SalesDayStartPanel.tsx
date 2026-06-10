"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  SalesDayStartItem,
  SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import {
  salesDayStartSourceLabel,
  sliceSalesDayStartItems,
} from "@/lib/sales/sales-day-start";
import type { MyOrderInboxFilter } from "@/lib/orders/my-order-inbox-filter";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { useSalesDayStartPanelCollapse } from "@/lib/sales/use-sales-day-start-panel-collapse";
import { SalesDayStartPinnedContext } from "@/components/moje/SalesDayStartPinnedContext";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconChevronDown, IconCircleCheck, IconSun } from "@/components/icons/StrokeIcons";
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
  onInboxFilter,
}: {
  item: SalesDayStartItem;
  previewHref: (href: string) => string;
  onInboxFilter?: (filter: MyOrderInboxFilter, scrollTarget?: string) => void;
}) {
  const router = useRouter();
  const tone = sourceTone(item.source);

  const handleClick = () => {
    if (item.inboxFilter && onInboxFilter) {
      onInboxFilter(item.inboxFilter, item.scrollTarget);
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

function clearedPinnedDescription(snapshot: SalesDayStartSnapshot): string {
  const hasAnnouncements =
    snapshot.pinnedAnnouncements.length > 0 || snapshot.pinnedAnnouncementOverflow > 0;
  const hasNotes = snapshot.pinnedNotes.length > 0 || snapshot.pinnedNoteOverflow > 0;
  if (hasAnnouncements && hasNotes) {
    return "Brak pilnych akcji — poniżej kontekst z tablicy i ZK.";
  }
  if (hasAnnouncements) {
    return "Brak pilnych akcji — poniżej przypięte ogłoszenia od zakupów.";
  }
  if (hasNotes) {
    return "Brak pilnych akcji — poniżej przypięte notatki.";
  }
  return "Brak pilnych akcji.";
}

export function SalesDayStartPanel({
  snapshot,
  onInboxFilter,
}: {
  snapshot: SalesDayStartSnapshot;
  onInboxFilter?: (filter: MyOrderInboxFilter, scrollTarget?: string) => void;
}) {
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const previewHref = (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla);

  const hasOpenTasks = !snapshot.cleared;
  const { collapsed, toggleCollapsed } = useSalesDayStartPanelCollapse(hasOpenTasks);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const hasPinnedContext =
    snapshot.pinnedNotes.length > 0 ||
    snapshot.pinnedNoteOverflow > 0 ||
    snapshot.pinnedAnnouncements.length > 0 ||
    snapshot.pinnedAnnouncementOverflow > 0;
  const { visible: visibleItems, hiddenCount } = sliceSalesDayStartItems(
    snapshot.items,
    itemsExpanded
  );

  const headerAction = !hasOpenTasks ? (
    <button
      type="button"
      onClick={toggleCollapsed}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Rozwiń panel Start dnia" : "Zwiń panel Start dnia"}
    >
      <IconChevronDown open={!collapsed} size={18} />
    </button>
  ) : undefined;

  if (snapshot.cleared && !hasPinnedContext) {
    if (collapsed) {
      return (
        <Card padding={false} className="overflow-hidden border-emerald-200/60 bg-emerald-50/20">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex w-full items-center justify-between gap-2 py-2.5 text-left",
              salesChromeInsetClass
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <IconCircleCheck size={18} className="text-emerald-600" aria-hidden />
              Start dnia — wszystko ogarnięte
            </span>
            <IconChevronDown open={false} size={18} className="shrink-0 text-slate-400" />
          </button>
        </Card>
      );
    }

    return (
      <Card padding={false} className="overflow-hidden border-emerald-200/70 bg-emerald-50/30">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-emerald-100 text-emerald-800">
              <IconCircleCheck size={20} />
            </SectionHeadingIcon>
          }
          title="Start dnia — wszystko ogarnięte"
          description="Brak pilnych akcji — możesz skupić się na nowych prośbach lub harmonogramie."
          action={headerAction}
          actionAlign="inline"
        />
        <div className={cn("flex flex-wrap gap-2 pb-3.5", salesChromeInsetClass)}>
          <Link href={previewHref("/prosba")}>
            <span className="inline-flex min-h-9 items-center rounded-md bg-white px-3 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
              Nowa prośba
            </span>
          </Link>
          <Link href={previewHref("/plan")}>
            <span className="inline-flex min-h-9 items-center rounded-md bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              Harmonogram
            </span>
          </Link>
        </div>
      </Card>
    );
  }

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
          collapsed && !hasOpenTasks
            ? undefined
            : snapshot.cleared
              ? clearedPinnedDescription(snapshot)
              : snapshot.totalActionCount === 1
                ? "1 rzecz wymaga reakcji — od najpilniejszych."
                : `${snapshot.totalActionCount} rzeczy wymaga reakcji — od najpilniejszych.`
        }
        action={headerAction}
        actionAlign="inline"
      />

      {!collapsed && !snapshot.cleared ? (
        <div className={cn("border-b border-slate-100 pb-3", salesChromeInsetClass)}>
          <ul className="flex flex-col gap-1.5">
            {visibleItems.map((item) => (
              <DayStartItemRow
                key={item.id}
                item={item}
                previewHref={previewHref}
                onInboxFilter={onInboxFilter}
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
      ) : null}

      {hasPinnedContext && (!collapsed || snapshot.cleared) ? (
        <SalesDayStartPinnedContext
          announcements={snapshot.pinnedAnnouncements}
          announcementOverflow={snapshot.pinnedAnnouncementOverflow}
          notes={snapshot.pinnedNotes}
          noteOverflow={snapshot.pinnedNoteOverflow}
          previewHref={previewHref}
        />
      ) : null}
    </Card>
  );
}
