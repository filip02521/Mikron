"use client";

import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { cn } from "@/lib/cn";

/** Jeden komunikat na formularzu prośby: Subiekt niedostępny i co handlowiec może zrobić. */
export function SubiektOfflineHint({
  feedback,
  className,
}: {
  feedback: SubiektFeedback;
  className?: string;
}) {
  const copy = PROSBA_FORM_SECTION_COPY.subiektOffline;
  const text = feedback.code === "not_configured" ? copy.manualOnly : copy.catalogFallback;

  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950",
        className
      )}
    >
      <IconAlertCircle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
