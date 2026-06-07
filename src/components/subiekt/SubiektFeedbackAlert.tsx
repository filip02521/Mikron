"use client";

import { Alert } from "@/components/ui/Alert";
import { FormStatusAlert } from "@/components/orders/FormStatusAlert";
import { subiektFeedbackBody } from "@/lib/orders/consolidate-form-status";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { cn } from "@/lib/cn";

/** Spójny komunikat błędu / informacji Subiekt (formularze, panel admina). */
export function SubiektFeedbackAlert({
  feedback,
  compact = false,
  embedded = false,
  className,
}: {
  feedback: SubiektFeedback;
  compact?: boolean;
  /** W panelu statusu — ta sama skala co FormStatusAlert. */
  embedded?: boolean;
  className?: string;
}) {
  const body = subiektFeedbackBody(feedback);

  if (embedded || compact) {
    return (
      <FormStatusAlert tone={feedback.tone} title={feedback.title} className={className}>
        {body}
      </FormStatusAlert>
    );
  }

  return (
    <Alert tone={feedback.tone} className={className}>
      <p className="font-medium">{feedback.title}</p>
      <p className="mt-0.5 opacity-90">{body}</p>
    </Alert>
  );
}
