"use client";

import { cn } from "@/lib/cn";
import {
  TEETH_EDIT_REQUEST_BANNER,
  TEETH_EDIT_REQUEST_TITLE,
} from "@/lib/teeth/teeth-procurement-flow-copy";

export function TeethProcurementRequestBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-900",
        className
      )}
      role="note"
    >
      <p className="font-semibold text-neutral-900">{TEETH_EDIT_REQUEST_TITLE}</p>
      <p className="mt-1 text-[13px] leading-snug text-neutral-900">
        {TEETH_EDIT_REQUEST_BANNER}
      </p>
    </div>
  );
}
