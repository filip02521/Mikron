"use client";

import { IconCircleCheck, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function ProductSourceBadge({
  fromSubiekt,
  className,
  size = 14,
}: {
  fromSubiekt: boolean;
  className?: string;
  size?: number;
}) {
  if (fromSubiekt) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800",
          className
        )}
        title="Zweryfikowano w Subiekcie — towar z kartoteki"
        aria-label="Zweryfikowano w Subiekcie"
      >
        <IconCircleCheck size={size} strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600",
        className
      )}
      title="Wpisanie ręczne — bez powiązania z kartoteką Subiekt"
      aria-label="Wpisanie ręczne"
    >
      <IconClipboardPen size={size} strokeWidth={2} />
    </span>
  );
}
