"use client";

import type { DeliveryStats, IndividualRequestKind, StatsMode } from "@/types/database";
import { RequestCompletenessBanner } from "@/components/orders/RequestCompletenessBanner";
import { SupplierLeadTimeHint } from "@/components/orders/SupplierLeadTimeHint";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import {
  type RequestCompleteness,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { cn } from "@/lib/cn";

function dedupeFeedbacks(items: SubiektFeedback[]): SubiektFeedback[] {
  const seen = new Set<string>();
  const out: SubiektFeedback[] = [];
  for (const f of items) {
    const key = `${f.tone}:${f.title ?? ""}:${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function RequestFormStatusPanel({
  requestKind,
  draft,
  forcedAssessment,
  subiektFeedbacks = [],
  resolvingSupplier = false,
  leadTime,
  scheduleHint,
  formMessage,
  className,
}: {
  requestKind: IndividualRequestKind;
  draft: RequestDraft;
  forcedAssessment?: RequestCompleteness | null;
  subiektFeedbacks?: Array<SubiektFeedback | null | undefined>;
  resolvingSupplier?: boolean;
  leadTime?: {
    stats: DeliveryStats | null | undefined;
    statsMode: StatsMode;
  } | null;
  scheduleHint?: string | null;
  formMessage?: { text: string; tone: "error" | "warning" | "success" } | null;
  className?: string;
}) {
  const alerts = dedupeFeedbacks(subiektFeedbacks.filter(Boolean) as SubiektFeedback[]);

  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4",
        className
      )}
      aria-live="polite"
      aria-relevant="additions text"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Status formularza
      </p>

      {formMessage ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            formMessage.tone === "error" && "border-red-200 bg-red-50 text-red-950",
            formMessage.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
            formMessage.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950"
          )}
        >
          {formMessage.text}
        </div>
      ) : null}

      {scheduleHint ? (
        <p className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-800">
          {scheduleHint}
        </p>
      ) : null}

      {resolvingSupplier ? (
        <p className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs text-indigo-800">
          <Spinner size="sm" />
          Szukam dostawcy w ostatnich ZD Subiekta…
        </p>
      ) : null}

      {alerts.map((feedback, i) => (
        <SubiektFeedbackAlert key={`${feedback.tone}-${i}`} feedback={feedback} compact />
      ))}

      {leadTime ? (
        <SupplierLeadTimeHint
          compact
          stats={leadTime.stats}
          statsMode={leadTime.statsMode}
          className="border-slate-200 bg-white"
        />
      ) : null}

      <RequestCompletenessBanner
        embedded
        draft={draft}
        requestKind={requestKind}
        forcedAssessment={forcedAssessment}
      />
    </div>
  );
}
