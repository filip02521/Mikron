import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";
import { isSalesZkNavPath } from "@/lib/sales/notepad-page-tabs";

export function stepPathnameForStep(step: SalesOnboardingStep): string | null {
  if (step.href) return step.href;
  return null;
}

export function pathnameMatchesOnboardingStep(
  pathname: string,
  step: SalesOnboardingStep
): boolean {
  if (step.href === pathname) return true;
  if (step.id === "notatnik" && isSalesZkNavPath(pathname)) return true;
  return false;
}

/** Blokuje sync pathname→krok, dopóki router nie dojedzie do celu nawigacji touru. */
export function shouldBlockTourPathSync(
  steps: SalesOnboardingStep[],
  pendingStepIndex: number | null,
  pathname: string
): boolean {
  if (pendingStepIndex === null) return false;
  const pendingStep = steps[pendingStepIndex];
  if (!pendingStep || pendingStep.id === "finish") return false;
  const target = stepPathnameForStep(pendingStep);
  if (!target) return false;
  return !pathnameMatchesOnboardingStep(pathname, pendingStep);
}

/** Indeks kroku touru pasujący do pathname (null = brak dopasowania). */
export function resolveTourStepIndexFromPathname(
  steps: SalesOnboardingStep[],
  pathname: string,
  currentIndex: number | null = null
): number | null {
  const finishIndex = steps.findIndex((s) => s.id === "finish");
  if (finishIndex >= 0 && currentIndex === finishIndex) {
    return finishIndex;
  }

  const hrefIndex = steps.findIndex((s) => pathnameMatchesOnboardingStep(pathname, s));
  return hrefIndex >= 0 ? hrefIndex : null;
}
