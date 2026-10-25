"use client";

import { cn } from "@/lib/cn";
import {
  pickZkWatchRowColorLegendItems,
  type ZkWatchRowColorLegendItem,
  type ZkWatchRowColorLegendItemId,
} from "@/lib/sales/zk-watch-row-color-legend";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Próbka tła wiersza — te same tony co obudowy w `zk-watch-attention-styles`. */
const SWATCH_TONE: Partial<Record<ZkWatchRowColorLegendItemId, string>> = {
  regal: "bg-indigo-50 ring-indigo-200",
  ready_to_close: "bg-emerald-50 ring-emerald-200",
  informacja: "bg-slate-50 ring-slate-300",
  follow_up: "bg-amber-50 ring-amber-200",
  new_lines: "bg-amber-50 ring-amber-200",
};

function LegendSwatch({ id }: { id: ZkWatchRowColorLegendItemId }) {
  const tone = SWATCH_TONE[id];
  if (!tone) return null;
  return <span className={cn("h-3 w-3 shrink-0 rounded-[3px] ring-1", tone)} aria-hidden />;
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
          ? "text-[0.6875rem] leading-snug text-slate-500"
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
            {" - "}
            {item.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
