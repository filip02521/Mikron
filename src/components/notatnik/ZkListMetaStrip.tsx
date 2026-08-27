import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatZkUnseenRegalBadge } from "@/lib/sales/zk-page-copy";
import { brandLinkSubtleClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { ZkWatchRowColorLegend } from "./ZkWatchRowColorLegend";

function ZkListStats({
  watchCount,
  lineCount,
  filteredWatchCount,
  searchActive,
  regalLineCount,
  informacjaReadyLineCount,
}: {
  watchCount: number;
  lineCount: number;
  filteredWatchCount: number;
  searchActive: boolean;
  regalLineCount: number;
  informacjaReadyLineCount: number;
}) {
  if (searchActive) {
    return (
      <p className={cn(salesTypography.chrome, "leading-relaxed")} aria-live="polite">
        Pokazano{" "}
        <span className={salesTypography.statValue}>{filteredWatchCount}</span>
        {" z "}
        <span className={salesTypography.statValue}>{watchCount}</span>
        <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
          szukaj
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="inline-flex items-baseline gap-1.5">
        <span className={salesTypography.statValue}>{watchCount}</span>
        <span className={salesTypography.statLabel}>ZK</span>
      </div>
      <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />
      <div className="inline-flex items-baseline gap-1.5">
        <span className={salesTypography.statValue}>{lineCount}</span>
        <span className={salesTypography.statLabel}>
          {lineCount === 1 ? "pozycja" : lineCount < 5 ? "pozycje" : "pozycji"}
        </span>
      </div>
      {informacjaReadyLineCount > 0 ? (
        <>
          <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="inline-flex items-baseline gap-1.5">
            <span className={cn(salesTypography.statValue, "text-sky-800")}>
              {informacjaReadyLineCount}
            </span>
            <span className={salesTypography.statLabel}>dostępne</span>
          </div>
        </>
      ) : null}
      {regalLineCount > 0 ? (
        <>
          <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="inline-flex items-baseline gap-1.5">
            <span className={cn(salesTypography.statValue, "text-violet-800")}>
              {regalLineCount}
            </span>
            <span className={salesTypography.statLabel}>na regale</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ZkListMetaActions({
  hasAttention,
  newLinesWatchCount,
  unseenRegalWatchCount,
  followUpCount,
  onOpenStatusGuide,
  trailing,
}: {
  hasAttention: boolean;
  newLinesWatchCount: number;
  unseenRegalWatchCount: number;
  followUpCount: number;
  onOpenStatusGuide?: () => void;
  trailing?: ReactNode;
}) {
  const hasTrailing = Boolean(trailing);
  const hasGuide = Boolean(onOpenStatusGuide);
  const hasBadges = hasAttention;

  if (!hasBadges && !hasGuide && !hasTrailing) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:justify-end">
      {hasBadges ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {newLinesWatchCount > 0 ? (
            <Badge variant="warning" className="text-[10px]">
              {newLinesWatchCount === 1
                ? "1 ZK z nową pozycją"
                : `${newLinesWatchCount} ZK z nowymi pozycjami`}
            </Badge>
          ) : null}
          {unseenRegalWatchCount > 0 ? (
            <Badge variant="purple" className="text-[10px]">
              {formatZkUnseenRegalBadge(unseenRegalWatchCount)}
            </Badge>
          ) : null}
          {followUpCount > 0 ? (
            <Badge variant="warning" className="text-[10px]">
              {followUpCount}{" "}
              {followUpCount === 1
                ? "przypomnienie"
                : followUpCount < 5
                  ? "przypomnienia"
                  : "przypomnień"}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {hasGuide ? (
        <button
          type="button"
          onClick={onOpenStatusGuide}
          className={cn(brandLinkSubtleClass, "shrink-0 text-xs font-semibold whitespace-nowrap")}
        >
          Statusy pozycji
        </button>
      ) : null}
      {hasTrailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function ZkListMetaStrip({
  watchCount,
  lineCount,
  filteredWatchCount,
  searchActive,
  regalLineCount,
  informacjaReadyLineCount = 0,
  newLinesWatchCount = 0,
  unseenRegalWatchCount = 0,
  followUpCount = 0,
  onOpenStatusGuide,
  trailing,
  bare = false,
  className,
}: {
  watchCount: number;
  lineCount: number;
  filteredWatchCount: number;
  searchActive: boolean;
  regalLineCount: number;
  informacjaReadyLineCount?: number;
  newLinesWatchCount?: number;
  unseenRegalWatchCount?: number;
  followUpCount?: number;
  onOpenStatusGuide?: () => void;
  trailing?: ReactNode;
  bare?: boolean;
  className?: string;
}) {
  const hasAttention =
    newLinesWatchCount > 0 || unseenRegalWatchCount > 0 || followUpCount > 0;

  const actions = (
    <ZkListMetaActions
      hasAttention={hasAttention}
      newLinesWatchCount={newLinesWatchCount}
      unseenRegalWatchCount={unseenRegalWatchCount}
      followUpCount={followUpCount}
      onOpenStatusGuide={onOpenStatusGuide}
      trailing={trailing}
    />
  );

  const shellClass = cn(
    "space-y-2",
    !bare && cn(salesChromeInsetClass, "border-b border-slate-100 bg-slate-50/35 py-2.5"),
    className
  );

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
        <div className="min-w-0 flex-1">
          <ZkListStats
            watchCount={watchCount}
            lineCount={lineCount}
            filteredWatchCount={filteredWatchCount}
            searchActive={searchActive}
            regalLineCount={regalLineCount}
            informacjaReadyLineCount={informacjaReadyLineCount}
          />
        </div>
        {actions}
      </div>

      {!searchActive ? (
        <div className="border-t border-slate-100/90 pt-2">
          <ZkWatchRowColorLegend
            variant="strip"
            regalLineCount={regalLineCount}
            informacjaReadyLineCount={informacjaReadyLineCount}
            followUpCount={followUpCount}
            newLinesWatchCount={newLinesWatchCount}
          />
        </div>
      ) : null}
    </div>
  );
}
