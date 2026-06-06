"use client";

import {
  buildProcurementFormReadiness,
  type ProcurementReadinessStep,
  type ProcurementReadinessStepState,
} from "@/lib/orders/procurement-form-readiness";
import type { ProsbaReadinessLine } from "@/lib/orders/prosba-form-readiness";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { IndividualRequestKind } from "@/types/database";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

function StepIcon({ state }: { state: ProcurementReadinessStepState }) {
  if (state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <IconCircleCheck size={12} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-dashed border-slate-300"
      aria-hidden
    />
  );
}

function StepRow({ step }: { step: ProcurementReadinessStep }) {
  return (
    <li className="flex gap-2">
      <StepIcon state={step.state} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-800">{step.label}</p>
        <p className="text-[11px] leading-snug text-slate-500">{step.detail}</p>
      </div>
    </li>
  );
}

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

/** Jedna sekcja statusu dla zakupów — checklista + tylko istotne alerty Subiekta (bez dublowania). */
export function ProcurementFormReadiness({
  salesPersonId,
  supplierId,
  lines,
  requestKind,
  informacjaViaDailyPanel = false,
  informacjaStockOutReorder = false,
  formMessage,
  resolvingSupplier = false,
  subiektFeedbacks = [],
  className,
}: {
  salesPersonId: string;
  supplierId: string;
  lines: ProsbaReadinessLine[];
  requestKind: IndividualRequestKind;
  informacjaViaDailyPanel?: boolean;
  informacjaStockOutReorder?: boolean;
  formMessage?: { text: string; tone: "error" | "warning" | "success" } | null;
  resolvingSupplier?: boolean;
  subiektFeedbacks?: Array<SubiektFeedback | null | undefined>;
  className?: string;
}) {
  const view = buildProcurementFormReadiness({
    salesPersonId,
    supplierId,
    lines,
    requestKind,
    informacjaViaDailyPanel,
    informacjaStockOutReorder,
  });

  const actionAlerts = dedupeFeedbacks(
    (subiektFeedbacks.filter(Boolean) as SubiektFeedback[]).filter(
      (f) => f.tone === "warning" || f.tone === "error"
    )
  );

  return (
    <div
      className={cn(
        "rounded-md border text-sm",
        view.tone === "ready"
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-slate-50/80",
        className
      )}
      aria-live="polite"
    >
      {formMessage ? (
        <div
          className={cn(
            "border-b px-3 py-2 text-sm",
            formMessage.tone === "error" && "border-red-200 bg-red-50 text-red-950",
            formMessage.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
            formMessage.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950"
          )}
        >
          {formMessage.text}
        </div>
      ) : null}

      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-sm font-semibold",
              view.tone === "ready" ? "text-emerald-950" : "text-slate-900"
            )}
          >
            {view.headline}
          </p>
          {view.canSubmit ? (
            <span className="text-[11px] font-medium text-emerald-800">Gotowe do zapisu</span>
          ) : null}
        </div>
        {view.subline ? (
          <p className="mt-0.5 text-xs text-slate-600">{view.subline}</p>
        ) : null}

        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {view.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ul>

        {resolvingSupplier ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-indigo-800">
            <Spinner size="sm" />
            Sprawdzam dostawcę w bazie…
          </p>
        ) : null}

        {actionAlerts.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {actionAlerts.map((feedback, i) => (
              <SubiektFeedbackAlert key={`${feedback.tone}-${i}`} feedback={feedback} compact />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
