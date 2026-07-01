"use client";

import {
  buildProsbaFormReadiness,
  type ProsbaFormReadinessView,
  type ProsbaReadinessLine,
  type ProsbaReadinessStep,
  type ProsbaReadinessStepState,
} from "@/lib/orders/prosba-form-readiness";
import type { SalesRequestSubmitPlan } from "@/lib/orders/sales-request-submit";
import type { IndividualRequestKind } from "@/types/database";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import {
  IconAlertCircle,
  IconChevronRight,
  IconCircleCheck,
} from "@/components/icons/StrokeIcons";
import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { SubmitHintChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

function StepIcon({ state }: { state: ProsbaReadinessStepState }) {
  if (state === "done") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <IconCircleCheck size={14} strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "action") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <IconAlertCircle size={14} strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "handoff") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-indigo-300 bg-indigo-50 text-indigo-700">
        <IconChevronRight size={13} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-dashed border-slate-300"
      aria-hidden
    />
  );
}

function toneStyles(tone: ProsbaFormReadinessView["tone"]) {
  switch (tone) {
    case "ready":
      return {
        shell: "border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white",
        headline: "text-emerald-950",
        subline: "text-emerald-800/90",
      };
    case "blocked":
      return {
        shell: "border-amber-200 bg-gradient-to-br from-amber-50/80 to-white",
        headline: "text-amber-950",
        subline: "text-amber-900/85",
      };
    case "handoff":
      return {
        shell: "border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white",
        headline: "text-indigo-950",
        subline: "text-indigo-800/90",
      };
    default:
      return {
        shell: "border-slate-200 bg-slate-50/80",
        headline: "text-slate-900",
        subline: "text-slate-600",
      };
  }
}

function ReadinessStepRow({ step }: { step: ProsbaReadinessStep }) {
  return (
    <li className="flex gap-2.5">
      <StepIcon state={step.state} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            step.state === "action" ? "text-amber-950" : "text-slate-800"
          )}
        >
          {step.label}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{step.detail}</p>
      </div>
    </li>
  );
}

function ReadinessStepsList({ steps }: { steps: ProsbaReadinessStep[] }) {
  return (
    <ul className="space-y-2.5 pt-2">
      {steps.map((step) => (
        <ReadinessStepRow key={step.id} step={step} />
      ))}
    </ul>
  );
}

export function ProsbaFormReadiness({
  lines,
  requestKind,
  salesSubmitPlan,
  formMessage,
  resolvingSupplier = false,
  informacjaPath = "direct",
  validationAttempted = false,
  compact = true,
  className,
  teethExemptTwIds,
}: {
  lines: ProsbaReadinessLine[];
  requestKind: IndividualRequestKind;
  salesSubmitPlan: SalesRequestSubmitPlan | null;
  formMessage?: { text: string; tone: "error" | "warning" | "success" } | null;
  resolvingSupplier?: boolean;
  informacjaPath?: InformacjaFlowPath;
  /** Po nieudanej próbie wysłania — rozwiń checklistę kroków. */
  validationAttempted?: boolean;
  /** Zwarty widok: ukryj gdy gotowe; kroki w rozwijanym panelu. */
  compact?: boolean;
  className?: string;
  teethExemptTwIds?: ReadonlySet<number>;
}) {
  const view = buildProsbaFormReadiness(lines, requestKind, salesSubmitPlan, {
    resolvingSupplier,
    informacjaPath,
    teethExemptTwIds,
  });
  const styles = toneStyles(view.tone);

  if (compact && view.canSubmit && !formMessage) {
    return null;
  }

  if (compact) {
    const expandSteps = validationAttempted || Boolean(formMessage);
    const readinessCopy = PROSBA_OPTIONAL_SECTION_COPY.readiness;

    return (
      <div
        className={cn("overflow-hidden rounded-md border", styles.shell, className)}
        aria-live="polite"
      >
        {formMessage ? (
          <div
            className={cn(
              "border-b px-3 py-2.5 text-sm",
              formMessage.tone === "error" && "border-red-200 bg-red-50 text-red-950",
              formMessage.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
              formMessage.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950"
            )}
          >
            {formMessage.text}
          </div>
        ) : null}

        <div className="px-3 py-2.5 sm:px-4">
          <p className={cn("text-sm font-semibold leading-snug", styles.headline)}>
            {view.headline}
          </p>
          {view.subline ? (
            <p className={cn("mt-0.5 text-xs leading-relaxed", styles.subline)}>
              {view.subline}
            </p>
          ) : null}

          <ProsbaOptionalSection
            kind="readiness"
            title={readinessCopy.title}
            showOptionalLabel={false}
            defaultOpen={expandSteps}
            className="mt-2 border-black/5 bg-white/50 open:bg-white/80"
            summaryClassName="px-2.5 py-2"
            bodyClassName="border-black/5 px-2.5 pb-2.5 pt-0"
          >
            <ReadinessStepsList steps={view.steps} />
          </ProsbaOptionalSection>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-md border shadow-sm", styles.shell, className)}
      aria-live="polite"
    >
      {formMessage ? (
        <div
          className={cn(
            "border-b px-3 py-2.5 text-sm",
            formMessage.tone === "error" && "border-red-200 bg-red-50 text-red-950",
            formMessage.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950"
          )}
        >
          {formMessage.text}
        </div>
      ) : null}

      <div className="px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("text-base font-semibold leading-snug", styles.headline)}>
              {view.headline}
            </p>
            {view.subline ? (
              <p className={cn("mt-1 text-xs leading-relaxed", styles.subline)}>
                {view.subline}
              </p>
            ) : null}
          </div>
          {view.canSubmit ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
              Wyślij
              <SubmitHintChevron />
            </span>
          ) : null}
        </div>

        <div className="mt-3 border-t border-black/5 pt-3">
          <ReadinessStepsList steps={view.steps} />
        </div>
      </div>
    </div>
  );
}
