"use client";

import { cn } from "@/lib/cn";
import {
  zdEstimateExternalSessionActiveStatusBody,
  zdEstimateExternalSessionActiveStatusTitle,
} from "@/lib/orders/zd-estimate-ui-copy";

/**
 * Status aktywnej sesji w sticky docku kreatora (obok „Anuluj sesję”).
 * Celowo w flow layoutu — nie fixed rail, żeby nie zasłaniać ⋯ w tabeli.
 */
export function ZdEstimateExternalSessionActiveChip({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      role="status"
      title={zdEstimateExternalSessionActiveStatusBody}
      aria-label={`${zdEstimateExternalSessionActiveStatusTitle}. ${zdEstimateExternalSessionActiveStatusBody}`}
      className={cn(
        "inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md",
        "border border-emerald-200/90 bg-emerald-50/90 px-2.5 text-emerald-900",
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="truncate text-xs font-medium leading-none">
        {zdEstimateExternalSessionActiveStatusTitle}
      </span>
    </div>
  );
}
