"use client";

import type { MyOrderProductLaneKind } from "@/lib/orders/my-order-lane-meta";
import { cn } from "@/lib/cn";

const laneBadgeClass: Record<Exclude<MyOrderProductLaneKind, "none">, string> = {
  teeth: "bg-emerald-100 text-emerald-800 ring-emerald-200/80",
  regular: "bg-slate-100 text-slate-700 ring-slate-200/80",
  mixed: "bg-gradient-to-r from-violet-100 to-emerald-100 text-violet-950 ring-violet-200/70",
};

const laneBadgeLabel: Record<Exclude<MyOrderProductLaneKind, "none">, string> = {
  teeth: "Zęby",
  regular: "Towar",
  mixed: "Zęby + towar",
};

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
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
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
      {laneBadgeLabel[laneKind]}
    </span>
  );
}
