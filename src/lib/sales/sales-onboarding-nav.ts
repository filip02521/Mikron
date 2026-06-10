import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";
import { isSalesZkNavPath } from "@/lib/sales/notepad-page-tabs";

export function stepPathnameForStep(step: SalesOnboardingStep): string | null {
  if (step.href) return step.href;
  if (step.id === "finish") return "/moje";
  return null;
}

function pathnameMatchesStep(pathname: string, step: SalesOnboardingStep): boolean {
  if (step.href === pathname) return true;
  if (step.id === "notatnik" && isSalesZkNavPath(pathname)) return true;
  return false;
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

  const hrefIndex = steps.findIndex((s) => pathnameMatchesStep(pathname, s));
  return hrefIndex >= 0 ? hrefIndex : null;
}
