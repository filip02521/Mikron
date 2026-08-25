"use client";

import { cn } from "@/lib/cn";
import {
  pickZkWatchRowColorLegendItems,
  type ZkWatchRowColorLegendItem,
  type ZkWatchRowColorLegendItemId,
} from "@/lib/sales/zk-watch-row-color-legend";
import { salesTypography } from "@/lib/ui/ontime-theme";

function LegendSwatch({ id }: { id: ZkWatchRowColorLegendItemId }) {
  switch (id) {
    case "regal":
      return (
        <span
          className="inline-flex h-3 w-3 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-violet-200/80"
          aria-hidden
        >
          <span className="w-[38%] bg-violet-500" />
          <span className="flex-1 bg-violet-50/90" />
        </span>
      );
    case "ready_to_close":
      return (
        <span
          className="inline-flex h-3 w-3 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-emerald-200/80"
          aria-hidden
        >
          <span className="w-[38%] bg-emerald-500" />
          <span className="flex-1 bg-emerald-50/90" />
        </span>
      );
    case "informacja":
      return (
        <span
          className="h-3 w-1 shrink-0 rounded-full bg-sky-500"
          aria-hidden
        />
      );
    case "follow_up":
      return (
        <span
          className="h-3 w-1 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
      );
    case "new_lines":
      return (
        <span
          className="inline-flex h-3 w-3 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-amber-200/80"
          aria-hidden
        >
          <span className="w-[38%] bg-amber-500" />
          <span className="flex-1 bg-amber-50/90" />
        </span>
      );
    default:
      return null;
  }
}

function LegendItem({ item }: { item: ZkWatchRowColorLegendItem }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={item.title}>
      <LegendSwatch id={item.id} />
      <span>{item.label}</span>
    </span>
  );
}

/** Wizualna legenda kolorów wiersza ZK — skrót nad listą. */
export function ZkWatchRowColorLegend({
  className,
  regalLineCount = 0,
  informacjaReadyLineCount = 0,
  followUpCount = 0,
  newLinesWatchCount = 0,
  compact = true,
  variant = "default",
}: {
  className?: string;
  regalLineCount?: number;
  informacjaReadyLineCount?: number;
  followUpCount?: number;
  newLinesWatchCount?: number;
  compact?: boolean;
  /** `strip` — zwarty pasek meta nad listą ZK. */
  variant?: "default" | "strip";
}) {
  const items = pickZkWatchRowColorLegendItems({
    regalLineCount,
    informacjaReadyLineCount,
    followUpCount,
    newLinesWatchCount,
    compact,
  });

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1",
        variant === "strip"
          ? "text-[10px] leading-snug text-slate-500"
          : salesTypography.chrome,
        className
      )}
      aria-label="Znaczenie kolorów wierszy ZK"
    >
      {items.map((item) => (
        <LegendItem key={item.id} item={item} />
      ))}
    </div>
  );
}

/** Pełna legenda wierszy — do przewodnika / pomocy. */
export function ZkWatchRowColorLegendGuide({ className }: { className?: string }) {
  return (
    <ul className={cn("space-y-2 text-xs leading-relaxed text-slate-700", className)}>
      {pickZkWatchRowColorLegendItems({ compact: false }).map((item) => (
        <li key={item.id} className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">
            <LegendSwatch id={item.id} />
          </span>
          <span>
            <strong className="font-medium text-slate-800">{item.title}</strong>
            {" — "}
            {item.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
