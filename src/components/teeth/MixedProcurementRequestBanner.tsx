"use client";

import { cn } from "@/lib/cn";
import {
  MIXED_PROCUREMENT_REQUEST_BANNER,
  MIXED_PROCUREMENT_REQUEST_BANNER_TITLE,
} from "@/lib/teeth/teeth-procurement-flow-copy";

export function MixedProcurementRequestBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-slate-800",
        className
      )}
      role="note"
    >
      <p className="font-semibold text-neutral-900">{MIXED_PROCUREMENT_REQUEST_BANNER_TITLE}</p>
      <p className="mt-1 text-[13px] leading-snug text-slate-700">
        {MIXED_PROCUREMENT_REQUEST_BANNER}
      </p>
    </div>
  );
}
