"use client";

import { cn } from "@/lib/cn";
import {
  ZK_WATCH_STATUS_GUIDE_ITEMS,
  zkWatchLineUiStateMeta,
} from "@/lib/sales/zk-watch-line-ui-state";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { ZkWatchLineStatusChip } from "./ZkWatchLineStatusChip";

export function ZkWatchStatusGuideContent({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <ul className={cn("space-y-2", compact ? "text-xs" : "text-sm")}>
        {ZK_WATCH_STATUS_GUIDE_ITEMS.map(({ state, hint }) => (
          <li key={state} className="flex items-start gap-2 leading-relaxed text-slate-700">
            <ZkWatchLineStatusChip state={state} className="mt-0.5 shrink-0" />
            <span>{hint}</span>
          </li>
        ))}
      </ul>
      <p className={cn(salesTypography.sectionHint, compact && "text-[0.68rem]")}>
        Typowy flow:{" "}
        {[
          zkWatchLineUiStateMeta("uncovered").shortLabel,
          zkWatchLineUiStateMeta("in_request").shortLabel,
          zkWatchLineUiStateMeta("delivered").shortLabel,
          zkWatchLineUiStateMeta("in_stock").shortLabel,
          zkWatchLineUiStateMeta("arrived").shortLabel,
        ].join(" → ")}
        . Na regale pozycje są zaznaczone automatycznie; odbiór fizyczny — w{" "}
        <strong className="font-medium text-slate-700">Moje zamówienia</strong>.
      </p>
    </div>
  );
}
