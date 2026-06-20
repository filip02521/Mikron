import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatZkUnseenRegalBadge } from "@/lib/sales/zk-page-copy";
import { brandLinkSubtleClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

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
  /** ZK z nieodczytanym przybyciem towaru na regale (nie liczba pozycji). */
  unseenRegalWatchCount?: number;
  followUpCount?: number;
  onOpenStatusGuide?: () => void;
  /** Prawa strona paska (np. skróty klawiszowe). */
  trailing?: ReactNode;
  /** Bez własnego tła i obramowania — do wspólnego paska z {@link trailing}. */
  bare?: boolean;
  className?: string;
}) {
  const hasAttention =
    newLinesWatchCount > 0 || unseenRegalWatchCount > 0 || followUpCount > 0;

  const content = (
    <>
      <div className="min-w-0 flex-1">
        {searchActive ? (
          <p className={cn(salesTypography.chrome, "leading-relaxed")} aria-live="polite">
            Pokazano{" "}
            <span className={salesTypography.statValue}>{filteredWatchCount}</span>
            {" z "}
            <span className={salesTypography.statValue}>{watchCount}</span>
            <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
              szukaj
            </span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
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
                  <span className={salesTypography.statValue}>{regalLineCount}</span>
                  <span className={salesTypography.statLabel}>na regale</span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {hasAttention ? (
          <>
            {newLinesWatchCount > 0 ? (
              <Badge variant="warning" className="text-[10px]">
                {newLinesWatchCount === 1
                  ? "1 ZK z nową pozycją"
                  : `${newLinesWatchCount} ZK z nowymi pozycjami`}
              </Badge>
            ) : null}
            {unseenRegalWatchCount > 0 ? (
              <Badge variant="success" className="text-[10px]">
                {formatZkUnseenRegalBadge(unseenRegalWatchCount)}
              </Badge>
            ) : null}
            {followUpCount > 0 ? (
              <Badge variant="purple" className="text-[10px]">
                {followUpCount}{" "}
                {followUpCount === 1
                  ? "przypomnienie"
                  : followUpCount < 5
                    ? "przypomnienia"
                    : "przypomnień"}
              </Badge>
            ) : null}
          </>
        ) : null}
        {onOpenStatusGuide ? (
          <button
            type="button"
            onClick={onOpenStatusGuide}
            className={cn(brandLinkSubtleClass, "text-xs font-semibold")}
          >
            Statusy pozycji
          </button>
        ) : null}
        {trailing}
      </div>
    </>
  );

  if (bare) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        salesChromeInsetClass,
        "flex flex-col gap-2 border-b border-slate-100 bg-slate-50/35 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {content}
    </div>
  );
}
