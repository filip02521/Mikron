"use client";

import type { DeliveryStats, IndividualRequestKind, StatsMode } from "@/types/database";
import { RequestCompletenessBanner } from "@/components/orders/RequestCompletenessBanner";
import { SupplierLeadTimeHint } from "@/components/orders/SupplierLeadTimeHint";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { FormStatusAlert } from "@/components/orders/FormStatusAlert";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import {
  type RequestCompleteness,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import {
  salesSubmitUserHint,
  type SalesRequestSubmitPlan,
} from "@/lib/orders/sales-request-submit";
import { consolidateSubiektFeedbacks } from "@/lib/orders/consolidate-form-status";
import { cn } from "@/lib/cn";

export function RequestFormStatusPanel({
  requestKind,
  draft,
  forcedAssessment,
  subiektFeedbacks = [],
  resolvingSupplier = false,
  salesSubmitPlan,
  leadTime,
  scheduleHint,
  formMessage,
  className,
  audience = "default",
  validationAttempted = false,
}: {
  requestKind: IndividualRequestKind;
  draft: RequestDraft;
  forcedAssessment?: RequestCompleteness | null;
  subiektFeedbacks?: Array<SubiektFeedback | null | undefined>;
  resolvingSupplier?: boolean;
  /** Formularz prośby handlowca — komunikat bez czekania na dostawcę. */
  salesSubmitPlan?: SalesRequestSubmitPlan | null;
  leadTime?: {
    stats: DeliveryStats | null | undefined;
    statsMode: StatsMode;
  } | null;
  scheduleHint?: string | null;
  formMessage?: { text: string; tone: "error" | "warning" | "success" } | null;
  className?: string;
  audience?: "procurement" | "default";
  /** Po nieudanym zapisie — kompletność pokazują już błędy przy polach. */
  validationAttempted?: boolean;
}) {
  const alerts = consolidateSubiektFeedbacks(
    subiektFeedbacks.filter(Boolean) as SubiektFeedback[]
  );

  const showCompleteness =
    !salesSubmitPlan &&
    !(validationAttempted && forcedAssessment === "incomplete");

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-slate-200/90 bg-slate-50/60 p-3 sm:p-3.5",
        className
      )}
      aria-live="polite"
      aria-relevant="additions text"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Status formularza
      </p>

      {formMessage ? (
        <FormStatusAlert tone={formMessage.tone}>{formMessage.text}</FormStatusAlert>
      ) : null}

      {scheduleHint ? (
        <FormStatusAlert tone="info">{scheduleHint}</FormStatusAlert>
      ) : null}

      {resolvingSupplier ? (
        <FormStatusAlert tone="info">
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            Sprawdzam dostawcę w naszej bazie…
          </span>
        </FormStatusAlert>
      ) : null}

      {salesSubmitPlan && !resolvingSupplier
        ? (() => {
            const hint = salesSubmitUserHint(salesSubmitPlan, requestKind);
            if (!hint) return null;
            return (
              <FormStatusAlert tone={hint.tone} title={hint.title}>
                {hint.detail}
              </FormStatusAlert>
            );
          })()
        : null}

      {alerts.map((feedback, i) => (
        <SubiektFeedbackAlert key={`${feedback.code}-${i}`} feedback={feedback} embedded />
      ))}

      {leadTime ? (
        <SupplierLeadTimeHint
          compact
          stats={leadTime.stats}
          statsMode={leadTime.statsMode}
          className="border-slate-200 bg-white text-xs"
        />
      ) : null}

      {showCompleteness ? (
        <RequestCompletenessBanner
          embedded
          draft={draft}
          requestKind={requestKind}
          forcedAssessment={forcedAssessment}
          audience={audience}
        />
      ) : null}
    </div>
  );
}
