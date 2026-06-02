"use client";

import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { formatPickupBarLabel } from "@/lib/orders/my-order-plural";
import { cn } from "@/lib/cn";

export function MojeStickyPickupBar({
  count,
  onShowPickup,
  className,
}: {
  count: number;
  onShowPickup: () => void;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-emerald-700/30 bg-emerald-600 px-3 py-2.5 text-white shadow-md sm:px-4",
        className
      )}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <IconPackageCheck size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
        <span className="truncate">{formatPickupBarLabel(count)}</span>
      </div>
      <button
        type="button"
        onClick={onShowPickup}
        className="min-h-10 shrink-0 rounded-md bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
      >
        Pokaż
      </button>
    </div>
  );
}
