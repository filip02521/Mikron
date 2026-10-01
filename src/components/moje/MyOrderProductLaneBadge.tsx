"use client";

import type { MyOrderProductLaneKind } from "@/lib/orders/my-order-lane-meta";
import { cn } from "@/lib/cn";

const laneBadgeClass: Record<Exclude<MyOrderProductLaneKind, "none">, string> = {
  teeth: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  regular: "bg-slate-50 text-slate-600 ring-slate-200/80",
  mixed: "bg-violet-50 text-violet-700 ring-violet-200/70",
};

const laneBadgeLabel: Record<Exclude<MyOrderProductLaneKind, "none">, string> = {
  teeth: "Zęby",
  regular: "Towar",
  mixed: "Zęby + towar",
};

function LaneIcon({ laneKind }: { laneKind: Exclude<MyOrderProductLaneKind, "none"> }) {
  if (laneKind === "teeth") {
    return (
      <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="currentColor" aria-hidden>
        <path d="M8 1.5c-1.2 0-2 .8-2.8 1.6C4.5 3.8 4 4.3 3.5 4.3c-.5 0-1 .3-1 1 0 1 .3 2 .8 3 .3.7.6 1.5.8 2.3.2.8.4 1.6 1 1.6.5 0 .7-.8.9-1.6.2-.8.4-1.6 1-1.6s.8.8 1 1.6c.2.8.4 1.6.9 1.6.6 0 .8-.8 1-1.6.2-.8.5-1.6.8-2.3.5-1 .8-2 .8-3 0-.7-.5-1-1-1-.5 0-1-.5-1.7-1.2C10 2.3 9.2 1.5 8 1.5Z" />
      </svg>
    );
  }
  if (laneKind === "mixed") {
    return (
      <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="currentColor" aria-hidden>
        <path d="M2 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Zm7 6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="currentColor" aria-hidden>
      <path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1-1-1V4Zm2 3v5h8V7H4Z" />
    </svg>
  );
}

export function MyOrderProductLaneBadge({
  laneKind,
  className,
}: {
  laneKind?: MyOrderProductLaneKind;
  className?: string;
}) {
  if (!laneKind || laneKind === "none") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-inset",
        laneBadgeClass[laneKind],
        className
      )}
      title={
        laneKind === "mixed"
          ? "Prośba zawiera zęby syntetyczne i inny towar"
          : laneKind === "teeth"
            ? "Pozycja zębowa — panel zębów"
            : undefined
      }
    >
      <LaneIcon laneKind={laneKind} />
      {laneBadgeLabel[laneKind]}
    </span>
  );
}
