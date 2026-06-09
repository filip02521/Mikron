"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SalesDayStartItem, SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
import {
  salesDayStartBreakdownLabels,
  salesDayStartSourceLabel,
} from "@/lib/sales/sales-day-start";
import type { MyOrderInboxFilter } from "@/lib/orders/my-order-inbox-filter";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { SalesDayStartPinnedNotes } from "@/components/moje/SalesDayStartPinnedNotes";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconCircleCheck, IconSun } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

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
          {item.evidence && item.evidence !== item.subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.evidence}</p>
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
  onInboxFilter,
  onBreakdownSelect,
  tourPreview = false,
}: {
  snapshot: SalesDayStartSnapshot;
  onInboxFilter?: (filter: MyOrderInboxFilter, scrollTarget?: string) => void;
  onBreakdownSelect?: (key: "orders" | "notepad" | "board") => void;
  tourPreview?: boolean;
}) {
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const previewHref = (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla);

  const breakdownChips = salesDayStartBreakdownLabels(snapshot.breakdown);
  const hasPinned =
    snapshot.pinnedNotes.length > 0 || snapshot.pinnedNoteOverflow > 0;

  if (snapshot.cleared && !hasPinned) {
    return (
      <Card padding={false} className="overflow-hidden border-emerald-200/70 bg-emerald-50/30">
        <div className={cn("flex items-start gap-3 py-3.5", salesChromeInsetClass)}>
          <SectionHeadingIcon tileClassName="bg-emerald-100 text-emerald-800">
            <IconCircleCheck size={20} />
          </SectionHeadingIcon>
          <div className="min-w-0 flex-1">
            <p className={cn(salesTypography.blockTitle, "text-emerald-950")}>
              Start dnia — wszystko ogarnięte
            </p>
            <p className={cn("mt-0.5", salesTypography.sectionHint)}>
              Brak oczekujących odbiorów, przypomnień i nowości z tablicy. Możesz skupić się na
              nowych prośbach lub harmonogramie.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
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
          </div>
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
          snapshot.cleared
            ? "Brak pilnych akcji — poniżej kontekst z przypiętych notatek."
            : snapshot.totalActionCount === 1
              ? "1 rzecz wymaga Twojej reakcji — uporządkowane od najpilniejszych."
              : `${snapshot.totalActionCount} rzeczy wymaga reakcji — uporządkowane od najpilniejszych.`
        }
      />

      {!snapshot.cleared ? (
        <div className={cn("border-b border-slate-100 pb-3", salesChromeInsetClass)}>
          {breakdownChips.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {breakdownChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  disabled={tourPreview}
                  onClick={() => onBreakdownSelect?.(chip.key)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <span className="tabular-nums text-indigo-700">{chip.count}</span>
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="flex flex-col gap-1.5">
            {snapshot.items.map((item) => (
              <DayStartItemRow
                key={item.id}
                item={item}
                previewHref={previewHref}
                onInboxFilter={onInboxFilter}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {hasPinned ? (
        <SalesDayStartPinnedNotes
          notes={snapshot.pinnedNotes}
          overflow={snapshot.pinnedNoteOverflow}
          previewHref={previewHref}
        />
      ) : null}
    </Card>
  );
}
