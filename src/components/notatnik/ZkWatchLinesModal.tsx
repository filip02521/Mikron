"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  formatZkWatchDisplayNumber,
  shouldShowZkWatchSubiektRealizedCloseHint,
  zkWatchStatusLabel,
} from "@/lib/sales/notepad-format";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import {
  buildZkWatchLineViews,
} from "@/lib/sales/zk-watch-lines";
import {
  filterZkWatchProductLineViewsForScope,
} from "@/lib/sales/zk-watch-prosba-scope";
import {
  buildZkWatchLineStatusSummary,
  isZkWatchAllProductLinesScopeExcluded,
  summarizeZkWatchLineCheckboxes,
} from "@/lib/sales/zk-watch-line-ui-state";
import type { ZkWatchLineCoverage, ZkLinkableOrder, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchLinesMetaSection } from "./ZkWatchLinesMetaSection";
import { ZkWatchLinesPanel } from "./ZkWatchLinesPanel";
import { ZkWatchNoteSection } from "./ZkWatchNoteSection";
import { ZkWatchProsbaSection } from "./ZkWatchProsbaSection";
import { ZkWatchTeethPreviewSection } from "./ZkWatchTeethPreviewSection";

function polishCountLabel(
  n: number,
  forms: [string, string, string]
): string {
  if (n === 1) return `${n} ${forms[0]}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${forms[1]}`;
  }
  return `${n} ${forms[2]}`;
}

export function ZkWatchLinesModal({
  watch,
  open,
  readOnly,
  tourPreview = false,
  archived,
  focusNote = false,
  linkableOrders = [],
  orderHints,
  matchedDeliveredLineKeys,
  newLineKeys,
  lineCoverageByKey,
  inStockLineKeys,
  informacjaReadyLineKeys,
  informacjaAcknowledgedLineKeys,
  scopeExcludedLineKeys,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  focusNote?: boolean;
  linkableOrders?: ZkLinkableOrder[];
  orderHints?: ZkWatchOrderHints;
  matchedDeliveredLineKeys?: string[];
  newLineKeys?: string[];
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
  inStockLineKeys?: string[];
  informacjaReadyLineKeys?: string[];
  informacjaAcknowledgedLineKeys?: string[];
  scopeExcludedLineKeys?: string[];
  onClose: () => void;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const [watchKey, setWatchKey] = useState(watch.id);
  if (open && watch.id !== watchKey) {
    setWatchKey(watch.id);
  }

  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const scopedLineViews = useMemo(
    () => filterZkWatchProductLineViewsForScope(lineViews, watch, { showAllLines: false }),
    [lineViews, watch]
  );
  const showSubiektRealizedCloseHint = useMemo(
    () =>
      shouldShowZkWatchSubiektRealizedCloseHint(watch, {
        lineViews: scopedLineViews,
        newLineKeys: newLineKeys ?? [],
        inStockLineKeys: inStockLineKeys ?? [],
        scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
        informacjaReadyLineKeys: informacjaReadyLineKeys ?? [],
        informacjaAcknowledgedLineKeys: informacjaAcknowledgedLineKeys ?? [],
        lineCoverageByKey,
      }),
    [
      watch,
      scopedLineViews,
      newLineKeys,
      inStockLineKeys,
      scopeExcludedLineKeys,
      informacjaReadyLineKeys,
      informacjaAcknowledgedLineKeys,
      lineCoverageByKey,
    ]
  );
  const checkboxSummary = useMemo(
    () =>
      summarizeZkWatchLineCheckboxes({
        lineViews: scopedLineViews,
        newLineKeys: newLineKeys ?? [],
        inStockLineKeys: inStockLineKeys ?? [],
        scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
        informacjaReadyLineKeys: informacjaReadyLineKeys ?? [],
        informacjaAcknowledgedLineKeys: informacjaAcknowledgedLineKeys ?? [],
        lineCoverageByKey,
      }),
    [scopedLineViews, newLineKeys, inStockLineKeys, scopeExcludedLineKeys, informacjaReadyLineKeys, informacjaAcknowledgedLineKeys, lineCoverageByKey]
  );
  const progressPct =
    checkboxSummary.total > 0
      ? Math.round((checkboxSummary.checked / checkboxSummary.total) * 100)
      : 0;
  const allScopeExcluded = isZkWatchAllProductLinesScopeExcluded({
    lineViews: scopedLineViews,
    scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
  });
  const scopedNewLineKeys = useMemo(() => {
    const scopedKeys = new Set(scopedLineViews.map((line) => line.key));
    return (newLineKeys ?? []).filter((key) => scopedKeys.has(key));
  }, [scopedLineViews, newLineKeys]);
  const hiddenNewLineCount = (newLineKeys?.length ?? 0) - scopedNewLineKeys.length;
  const subiektStatus = zkWatchStatusLabel(watch);
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const progressLabel =
    checkboxSummary.total > 0
      ? `${checkboxSummary.checked}/${checkboxSummary.total} zaznaczone`
      : null;
  const newLineCount = scopedNewLineKeys.length;
  const lineStatusSummary = buildZkWatchLineStatusSummary({
    lineViews: scopedLineViews,
    newLineKeys: newLineKeys ?? [],
    inStockLineKeys: inStockLineKeys ?? [],
    scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
    informacjaReadyLineKeys: informacjaReadyLineKeys ?? [],
    informacjaAcknowledgedLineKeys: informacjaAcknowledgedLineKeys ?? [],
    lineCoverageByKey,
  });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      title={watch.client_label}
      description={displayNumber}
      className="max-h-[min(calc(100dvh-1rem),840px)]"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      footer={
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Zamknij
        </Button>
      }
    >
      {open ? (
        <>
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {checkboxSummary.total > 0 ? (
                  <span className={cn(salesTypography.rowBody, "font-medium text-slate-700")}>
                    {progressLabel ??
                      `${checkboxSummary.checked}/${checkboxSummary.total} zaznaczone`}
                  </span>
                ) : allScopeExcluded ? (
                  <span className={cn(salesTypography.rowBody, "font-medium text-slate-700")}>
                    Wszystkie pozycje pominięte — bez prośby
                  </span>
                ) : (
                  <span className={salesTypography.rowMeta}>Brak szczegółowej listy towaru</span>
                )}
                {subiektStatus && subiektStatus !== "Aktywne" ? (
                  <Badge variant="info" className="text-[10px]">
                    {subiektStatus}
                  </Badge>
                ) : null}
                {archived ? (
                  <Badge variant="default" className="text-[10px]">
                    Archiwum
                  </Badge>
                ) : null}
              </div>
              {checkboxSummary.total > 0 || allScopeExcluded ? (
                <span className={cn(salesTypography.statValue, "text-indigo-900")}>
                  {allScopeExcluded ? "100%" : `${progressPct}%`}
                </span>
              ) : null}
            </div>
            {checkboxSummary.total > 0 || allScopeExcluded ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    progressPct === 100 || allScopeExcluded ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${allScopeExcluded ? 100 : progressPct}%` }}
                />
              </div>
            ) : null}
            {lineStatusSummary ? (
              <p className={cn("mt-2", salesTypography.rowMeta, "text-slate-600")}>
                {lineStatusSummary}
              </p>
            ) : null}
            {followUpLabel && !archived ? (
              <p
                className={cn(
                  "mt-2",
                  salesTypography.rowMeta,
                  followUpDue ? "font-semibold text-amber-800" : "text-slate-500"
                )}
              >
                {followUpDue ? "Przypomnienie do działania" : "Przypomnienie"}: {followUpLabel}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            {newLineCount > 0 || hiddenNewLineCount > 0 ? (
              <div className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950">
                <p className="font-medium">
                  {newLineCount > 0
                    ? polishCountLabel(newLineCount, ["nowa pozycja", "nowe pozycje", "nowych pozycji"])
                    : polishCountLabel(hiddenNewLineCount, [
                        "nowa pozycja",
                        "nowe pozycje",
                        "nowych pozycji",
                      ])}{" "}
                  od ostatniego odświeżenia
                  {hiddenNewLineCount > 0 && newLineCount > 0
                    ? ` (+${hiddenNewLineCount} poza wybranym zakresem)`
                    : null}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/85">
                  {hiddenNewLineCount > 0 && newLineCount === 0
                    ? "Nowe pozycje są poza wybranym zakresem — rozwiń pełne ZK w sekcji „Lista towaru”, aby je zobaczyć i ewentualnie dodać do prośby."
                    : "Pozycje oznaczone „Nowa” nie są jeszcze w prośbie. Użyj przycisku na karcie ZK, aby wysłać uzupełniającą prośbę tylko dla brakujących pozycji."}
                </p>
              </div>
            ) : null}
            <ZkWatchProsbaSection
              watch={watch}
              linkableOrders={linkableOrders}
              orderHints={orderHints}
              readOnly={readOnly}
              tourPreview={tourPreview}
              archived={archived}
              newLineKeys={newLineKeys}
            />
            <ZkWatchNoteSection
              key={`${watchKey}-note`}
              watch={watch}
              readOnly={readOnly}
              tourPreview={tourPreview}
              archived={archived}
              focusNote={focusNote}
              onSaved={(updated) => onSaved?.(updated)}
            />
            <ZkWatchLinesMetaSection
              key={`${watchKey}-meta`}
              watch={watch}
              readOnly={readOnly}
              tourPreview={tourPreview}
              archived={archived}
              showSubiektRealizedCloseHint={showSubiektRealizedCloseHint}
            />
            <ZkWatchTeethPreviewSection
              watch={watch}
              tourPreview={tourPreview}
              readOnly={readOnly}
            />
            <ZkWatchLinesPanel
              key={watchKey}
              watch={watch}
              readOnly={readOnly}
              tourPreview={tourPreview}
              matchedDeliveredLineKeys={matchedDeliveredLineKeys}
              newLineKeys={newLineKeys}
              lineCoverageByKey={lineCoverageByKey}
              inStockLineKeys={inStockLineKeys}
              informacjaReadyLineKeys={informacjaReadyLineKeys}
              informacjaAcknowledgedLineKeys={informacjaAcknowledgedLineKeys}
              scopeExcludedLineKeys={scopeExcludedLineKeys}
              linkableOrders={linkableOrders}
              onSaved={onSaved}
              showSummary={false}
            />
          </div>
        </>
      ) : null}
    </ModalShell>
  );
}
