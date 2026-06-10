"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  formatZkWatchDisplayNumber,
  zkWatchStatusLabel,
} from "@/lib/sales/notepad-format";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import {
  buildZkWatchLineViews,
  formatZkLinesProgress,
  summarizeZkWatchLines,
} from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchLinesMetaSection } from "./ZkWatchLinesMetaSection";
import { ZkWatchLinesPanel } from "./ZkWatchLinesPanel";

export function ZkWatchLinesModal({
  watch,
  open,
  readOnly,
  tourPreview = false,
  archived,
  focusNote = false,
  matchedDeliveredLineKeys,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  focusNote?: boolean;
  matchedDeliveredLineKeys?: string[];
  onClose: () => void;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const [watchKey, setWatchKey] = useState(watch.id);

  useEffect(() => {
    if (open) setWatchKey(watch.id);
  }, [open, watch.id]);

  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const summary = useMemo(() => summarizeZkWatchLines(lineViews), [lineViews]);
  const progressPct =
    summary.total > 0 ? Math.round((summary.arrived / summary.total) * 100) : 0;
  const subiektStatus = zkWatchStatusLabel(watch);
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const progressLabel = formatZkLinesProgress(lineViews);

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
                {summary.total > 0 ? (
                  <span className={cn(salesTypography.rowBody, "font-medium text-slate-700")}>
                    {progressLabel ?? `${summary.arrived}/${summary.total} na miejscu`}
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
              {summary.total > 0 ? (
                <span className={cn(salesTypography.statValue, "text-indigo-900")}>
                  {progressPct}%
                </span>
              ) : null}
            </div>
            {summary.total > 0 ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    progressPct === 100 ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
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
            <ZkWatchLinesMetaSection
              key={`${watchKey}-meta`}
              watch={watch}
              readOnly={readOnly}
              tourPreview={tourPreview}
              archived={archived}
              focusNote={focusNote}
              onSaved={(updated) => onSaved?.(updated)}
            />
            <ZkWatchLinesPanel
              key={watchKey}
              watch={watch}
              readOnly={readOnly}
              tourPreview={tourPreview}
              matchedDeliveredLineKeys={matchedDeliveredLineKeys}
              onSaved={onSaved}
              showSummary={false}
            />
          </div>
        </>
      ) : null}
    </ModalShell>
  );
}
