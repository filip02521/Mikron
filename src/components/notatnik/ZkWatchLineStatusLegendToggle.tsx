"use client";

import { useState } from "react";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  buildContextualZkWatchStatusLegend,
} from "@/lib/sales/zk-watch-contextual-status-legend";
import type { ZkWatchLineUiStateCounts } from "@/lib/sales/zk-watch-line-ui-state";
import { ZkWatchLineStatusChip } from "./ZkWatchLineStatusChip";

export function ZkWatchLineStatusLegendToggle({
  counts,
}: {
  counts: ZkWatchLineUiStateCounts;
}) {
  const [open, setOpen] = useState(false);
  const items = buildContextualZkWatchStatusLegend(counts);
  if (items.length === 0) return null;

  return (
    <div className="border-t border-slate-100/90 pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-slate-500 transition hover:text-slate-700"
      >
        <IconChevronRight
          size={12}
          className={cn("shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        {open ? "Ukryj legendę statusów" : "Co oznaczają statusy?"}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5">
          {items.map(({ state, hint }) => (
            <li
              key={state}
              className="flex items-start gap-2 text-[0.68rem] leading-snug text-slate-600"
            >
              <ZkWatchLineStatusChip state={state} className="mt-px shrink-0 scale-90" />
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
