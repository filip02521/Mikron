"use client";

import { Alert } from "@/components/ui/Alert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { cn } from "@/lib/cn";

/** Spójny komunikat błędu / informacji Subiekt (formularze, panel admina). */
export function SubiektFeedbackAlert({
  feedback,
  compact = false,
  className,
}: {
  feedback: SubiektFeedback;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Alert tone={feedback.tone} className={cn(compact && "py-2", className)}>
      <p className={cn("font-medium", compact && "text-xs")}>{feedback.title}</p>
      <p className={cn(compact ? "text-xs" : "text-sm", "mt-0.5 opacity-90")}>
        {feedback.message}
      </p>
      {feedback.hint ? (
        <p className={cn("mt-1.5 opacity-80", compact ? "text-[11px]" : "text-xs")}>
          {feedback.hint}
        </p>
      ) : null}
    </Alert>
  );
}
