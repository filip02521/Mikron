import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";

export function stepPathnameForStep(step: SalesOnboardingStep): string | null {
  if (step.href) return step.href;
  if (step.id === "finish") return "/moje";
  return null;
}

/** Indeks kroku touru pasujący do pathname (null = brak dopasowania). */
export function resolveTourStepIndexFromPathname(
  steps: SalesOnboardingStep[],
  pathname: string,
  currentIndex: number | null = null
): number | null {
  const finishIndex = steps.findIndex((s) => s.id === "finish");
  if (
    finishIndex >= 0 &&
    currentIndex === finishIndex &&
    pathname === "/moje"
  ) {
    return finishIndex;
  }

  const hrefIndex = steps.findIndex((s) => s.href === pathname);
  return hrefIndex >= 0 ? hrefIndex : null;
}
