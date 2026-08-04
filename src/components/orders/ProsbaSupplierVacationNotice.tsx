"use client";

import { IconSun } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { noticeToneShellClass } from "@/lib/ui/notice-content";
import type { ProsbaVacationNoticeModel } from "@/lib/orders/prosba-supplier-vacation-copy";

/** Informacja o urlopie dostawcy — przy produktach (nie blokuje wysyłki). */
export function ProsbaSupplierVacationNotice({
  model,
  className,
}: {
  model: ProsbaVacationNoticeModel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-amber-300/90 px-3 py-2.5 shadow-sm ring-1 ring-amber-200/70 sm:px-3.5",
        noticeToneShellClass.warning,
        className
      )}
      role="status"
      aria-live="polite"
      title={model.rangeTitle}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100 ring-1 ring-amber-300/80">
          <IconSun size={18} strokeWidth={2.25} className="text-amber-700" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-snug text-amber-950">
            {model.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-950/90 sm:text-[13px]">
            {model.description}
          </p>
        </div>
      </div>
    </div>
  );
}
