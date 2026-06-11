"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSalesOnboarding } from "@/app/actions/sales-onboarding";
import {
  SalesOnboardingPanelPreview,
  SalesOnboardingStepHeader,
} from "@/components/sales/SalesOnboardingPanelPreview";
import { useSalesOnboarding, clearSalesOnboardingTourStarted } from "@/components/sales/SalesOnboardingContext";
import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import { Button } from "@/components/ui/Button";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";

function polishCountLabel(
  n: number,
  forms: [string, string, string]
): string {
  if (n === 1) return `${n} ${forms[0]}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${forms[1]}`;
  }
  return `${n} ${forms[2]}`;
}

function subscribeMediaQuery(query: string, callback: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function useMinMdViewport() {
  return useSyncExternalStore(
    (cb) => subscribeMediaQuery("(min-width: 768px)", cb),
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

function StepTitle({
  step,
  displayName,
  className,
}: {
  step: SalesOnboardingStep;
  displayName?: string | null;
  className?: string;
}) {
  return (
    <h2
      id="sales-onboarding-title"
      className={cn("font-semibold tracking-tight text-slate-900", className)}
    >
      {step.id === "welcome" && displayName ? (
        <>
          Witaj, <span className="text-indigo-700">{displayName}</span>
        </>
      ) : (
        step.title
      )}
    </h2>
  );
}

function TourStepContent({
  step,
  displayName,
  previewMode,
  showFullDetails,
}: {
  step: SalesOnboardingStep;
  displayName?: string | null;
  previewMode: "live" | "finish" | "none";
  showFullDetails: boolean;
}) {
  if (!showFullDetails) {
    return (
      <div className="space-y-2">
        <SalesOnboardingStepHeader step={step} compact />
        <StepTitle step={step} displayName={displayName} className="text-base" />
        <p className="text-sm leading-snug text-slate-600">{step.lead}</p>
        {step.bullets[0] ? (
          <p className="flex gap-2 text-xs leading-relaxed text-slate-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
            <span className="line-clamp-2">{step.bullets[0]}</span>
          </p>
        ) : null}
        <p className="text-[11px] font-medium text-indigo-700">
          Rozwiń, aby zobaczyć {step.bullets.length}{" "}
          {step.bullets.length === 1
            ? "punkt"
            : step.bullets.length < 5
              ? "punkty"
              : "punktów"}
          {step.tip ? " i wskazówkę" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 pb-1">
      <SalesOnboardingStepHeader step={step} compact />
      <StepTitle step={step} displayName={displayName} className="text-base md:text-[1.05rem]" />
      <p className="text-sm leading-relaxed text-slate-600">{step.lead}</p>

      <ul className="space-y-2">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-xs leading-relaxed text-slate-700 md:text-[13px]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {step.tip ? (
        <p className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-indigo-950">
          <strong className="font-semibold">Wskazówka:</strong> {step.tip}
        </p>
      ) : null}

      {previewMode === "live" ? (
        <p className="rounded-md border border-slate-200/90 bg-white/80 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
          Na ekranie widać tę zakładkę z{" "}
          <strong className="font-medium text-slate-700">przykładowymi danymi</strong>. Możesz
          przewinąć stronę i obejrzeć układ.
        </p>
      ) : null}

      {previewMode === "finish" ? (
        <p className="rounded-md border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-950">
          Za chwilę zobaczysz <strong className="font-medium">swoje dane</strong>. Kliknij „Zakończ
          tour”, aby wejść do panelu.
        </p>
      ) : null}
    </div>
  );
}

function WelcomeStepContent({
  step,
  displayName,
}: {
  step: SalesOnboardingStep;
  displayName?: string | null;
}) {
  return (
    <div className="space-y-3">
      <SalesOnboardingStepHeader step={step} />
      <StepTitle step={step} displayName={displayName} className="text-xl sm:text-2xl" />
      <p className="text-sm leading-relaxed text-slate-600">{step.lead}</p>
      <ul className="space-y-2.5">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-3 sm:p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          OnTime w skrócie
        </p>
        <SalesOnboardingPanelPreview stepId={step.id} />
      </div>
    </div>
  );
}

export function SalesOnboardingWizard() {
  const router = useRouter();
  const isDesktop = useMinMdViewport();
  const {
    steps,
    stepIndex,
    currentStep: step,
    isWelcomeStep,
    isFinishStep,
    isLivePreviewStep,
    goNext,
    goBack,
    displayName,
  } = useSalesOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [coachHighlight, setCoachHighlight] = useState(true);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const showFullDetails = isDesktop || mobileDetailsOpen;
  const [appliedStepIndex, setAppliedStepIndex] = useState(stepIndex);
  if (stepIndex !== appliedStepIndex) {
    setAppliedStepIndex(stepIndex);
    setMobileDetailsOpen(false);
    setCoachHighlight(true);
  }

  useEffect(() => {
    if (!coachHighlight) return;
    const timer = window.setTimeout(() => setCoachHighlight(false), 8000);
    return () => window.clearTimeout(timer);
  }, [stepIndex, coachHighlight]);

  const progressDots = useMemo(
    () =>
      steps.map((s, i) => (
        <span
          key={s.id}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === stepIndex ? "w-5 bg-indigo-600" : i < stepIndex ? "w-1.5 bg-indigo-300" : "w-1.5 bg-slate-200"
          )}
        />
      )),
    [stepIndex, steps]
  );

  function finishOnboarding() {
    setError(null);
    startTransition(async () => {
      const result = await completeSalesOnboarding();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearSalesOnboardingTourStarted();
      router.push("/moje");
      router.refresh();
    });
  }

  function handleNext() {
    if (!isLast) {
      goNext();
      return;
    }
    finishOnboarding();
  }

  if (isWelcomeStep) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-onboarding-title"
      >
        <div className="relative flex max-h-[min(100dvh,920px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/40 shadow-2xl sm:rounded-lg">
          <BrandCardAccent className="absolute -right-10 -top-10 h-40 w-48 opacity-80" />

          <div className="relative z-[1] border-b border-slate-100 bg-white/80 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600/90">
                  Wprowadzenie · OnTime
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Krok {stepIndex + 1} z {steps.length}
                  {displayName ? (
                    <>
                      {" "}
                      · <span className="font-medium text-slate-700">{displayName}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-1" aria-hidden>
                {progressDots}
              </div>
            </div>
          </div>

          <div className="relative z-[1] flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <WelcomeStepContent step={step} displayName={displayName} />
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="relative z-[1] flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/90 px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="min-h-11"
              disabled={pending}
              onClick={finishOnboarding}
            >
              Pomiń wprowadzenie
            </Button>
            <Button
              type="button"
              size="md"
              className="min-h-11 px-6 font-semibold"
              disabled={pending}
              onClick={handleNext}
            >
              Rozpocznij tour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[110] flex flex-col border bg-gradient-to-br from-white via-white to-indigo-50/30 shadow-xl transition-shadow duration-500",
        coachHighlight
          ? "border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.35),0_12px_40px_rgba(15,23,42,0.18)]"
          : "border-slate-200/90",
        showFullDetails && !isDesktop
          ? "inset-x-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] max-h-[min(58dvh,24rem)] rounded-lg"
          : "inset-x-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] max-h-[min(34dvh,11.5rem)] rounded-lg",
        "md:inset-x-auto md:bottom-4 md:right-4 md:top-[4.75rem] md:max-h-none md:w-80 md:rounded-lg"
      )}
      role="dialog"
      aria-modal="false"
      aria-labelledby="sales-onboarding-title"
    >
      <div className="relative z-[2] hidden shrink-0 rounded-t-lg bg-indigo-600 px-3 py-2 text-center md:block">
        <p className="text-xs font-semibold text-white">Panel wprowadzenia</p>
        <p className="inline-flex items-center justify-center gap-1 text-[11px] text-indigo-100">
          Przechodź kroki przyciskiem „Dalej”
          <LinkChevron size={13} tone="inherit" className="text-indigo-100" />
        </p>
      </div>

      <div className="relative z-[2] shrink-0 rounded-t-lg bg-indigo-600 px-3 py-1.5 text-center md:hidden">
        <p className="text-[11px] font-semibold text-white">Panel wprowadzenia · użyj „Dalej” poniżej</p>
      </div>

      <BrandCardAccent className="pointer-events-none absolute -right-8 -top-8 h-20 w-24 opacity-50" />

      <div className="relative z-[1] shrink-0 border-b border-slate-100/90 px-3 py-2.5 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600/90">
              Tour · krok {stepIndex + 1}/{steps.length}
            </p>
            <p className="truncate text-xs font-medium text-slate-700">{step.title}</p>
          </div>
          <div className="flex shrink-0 gap-1 pt-0.5" aria-hidden>
            {progressDots}
          </div>
        </div>
      </div>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 md:py-3">
        <TourStepContent
          step={step}
          displayName={displayName}
          previewMode={
            isFinishStep ? "finish" : isLivePreviewStep ? "live" : "none"
          }
          showFullDetails={showFullDetails}
        />
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="relative z-[1] shrink-0 space-y-2 border-t border-slate-100/90 bg-white/95 px-3 py-2.5 sm:px-4">
        {!isDesktop ? (
          <button
            type="button"
            className="w-full text-left text-xs font-medium text-indigo-700 hover:text-indigo-900"
            onClick={() => setMobileDetailsOpen((open) => !open)}
            aria-expanded={mobileDetailsOpen}
          >
            {mobileDetailsOpen
              ? "Zwiń opis kroku"
              : `Pokaż pełny opis (${polishCountLabel(step.bullets.length, [
                  "punkt",
                  "punkty",
                  "punktów",
                ])}${step.tip ? " + wskazówka" : ""})`}
          </button>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0 px-2"
            disabled={isFirst || pending}
            onClick={goBack}
          >
            Wstecz
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-9 flex-1 px-3 font-semibold"
            disabled={pending}
            onClick={handleNext}
          >
            {pending ? "Zapis…" : isLast ? "Zakończ tour" : "Dalej"}
          </Button>
        </div>
      </div>
    </div>
  );
}
