"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getSalesOnboardingSteps,
  isManagerOnlyOnboardingStep,
  type SalesOnboardingStep,
} from "@/lib/sales/sales-onboarding-steps";
import {
  pathnameMatchesOnboardingStep,
  resolveTourStepIndexFromPathname,
  shouldBlockTourPathSync,
  stepPathnameForStep,
} from "@/lib/sales/sales-onboarding-nav";
import type { UserRole } from "@/types/database";

type SalesOnboardingContextValue = {
  active: boolean;
  steps: SalesOnboardingStep[];
  stepIndex: number;
  currentStep: SalesOnboardingStep;
  currentStepId: string;
  isWelcomeStep: boolean;
  isFinishStep: boolean;
  isLivePreviewStep: boolean;
  showCoach: boolean;
  navLocked: boolean;
  coachPaddingClass: string;
  setStepIndex: (index: number) => void;
  goNext: () => void;
  goBack: () => void;
  isDemoForStep: (stepId: string) => boolean;
  displayName?: string | null;
};

const SalesOnboardingContext = createContext<SalesOnboardingContextValue | null>(null);

const TOUR_STARTED_STORAGE_KEY = "sales-onboarding-tour-started";

function markTourStarted() {
  try {
    sessionStorage.setItem(TOUR_STARTED_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function clearSalesOnboardingTourStarted() {
  try {
    sessionStorage.removeItem(TOUR_STARTED_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

function isTourStarted(stepIndex: number): boolean {
  if (stepIndex > 0) return true;
  try {
    return sessionStorage.getItem(TOUR_STARTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function useSalesOnboardingHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function resolveDisplayStepIndex(
  steps: SalesOnboardingStep[],
  pathname: string,
  navigatedStepIndex: number,
  pendingStepIndex: number | null,
  hydrated: boolean,
  active: boolean
): number {
  if (!hydrated || !active) return navigatedStepIndex;

  if (shouldBlockTourPathSync(steps, pendingStepIndex, pathname)) {
    const matched = resolveTourStepIndexFromPathname(steps, pathname, null);
    if (matched != null && pendingStepIndex != null && matched !== pendingStepIndex) {
      return matched;
    }
    return navigatedStepIndex;
  }

  const step = steps[navigatedStepIndex];
  if (!step || step.id === "finish") return navigatedStepIndex;

  if (!isTourStarted(navigatedStepIndex)) return navigatedStepIndex;

  const matched = resolveTourStepIndexFromPathname(steps, pathname, navigatedStepIndex);
  if (matched != null && matched !== navigatedStepIndex) return matched;

  if (navigatedStepIndex === 0 && matched != null && matched > 0) return matched;

  return navigatedStepIndex;
}

export function SalesOnboardingProvider({
  active,
  role,
  displayName,
  children,
}: {
  active: boolean;
  role: UserRole;
  displayName?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const steps = useMemo(() => getSalesOnboardingSteps(role), [role]);
  const hydrated = useSalesOnboardingHydrated();
  const [navigatedStepIndex, setNavigatedStepIndex] = useState(0);
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);

  const effectivePendingStepIndex =
    pendingStepIndex !== null &&
    shouldBlockTourPathSync(steps, pendingStepIndex, pathname)
      ? pendingStepIndex
      : null;

  const displayStepIndex = useMemo(
    () =>
      resolveDisplayStepIndex(
        steps,
        pathname,
        navigatedStepIndex,
        effectivePendingStepIndex,
        hydrated,
        active
      ),
    [steps, pathname, navigatedStepIndex, effectivePendingStepIndex, hydrated, active]
  );

  useEffect(() => {
    if (!active || pendingStepIndex === null) return;
    if (!shouldBlockTourPathSync(steps, pendingStepIndex, pathname)) return;
    const timeout = window.setTimeout(() => {
      setPendingStepIndex(null);
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [active, pathname, pendingStepIndex, steps]);

  const currentStep = steps[displayStepIndex] ?? steps[0]!;
  const currentStepId = currentStep.id;
  const isWelcomeStep = currentStepId === "welcome";
  const isFinishStep = currentStepId === "finish";
  const isLivePreviewStep = Boolean(currentStep.href);
  const showCoach = active && !isWelcomeStep;
  const navLocked = showCoach;

  const navigateToStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, steps.length - 1));
      const step = steps[clamped]!;
      if (isManagerOnlyOnboardingStep(step.id) && role !== "sales_manager") {
        return;
      }
      if (clamped > 0) markTourStarted();
      setPendingStepIndex(clamped);
      setNavigatedStepIndex(clamped);
      const target = stepPathnameForStep(step);
      if (target && target !== pathname) {
        router.push(target);
      } else {
        setPendingStepIndex(null);
      }
    },
    [pathname, role, router, steps]
  );

  const setStepIndex = useCallback(
    (index: number) => {
      navigateToStep(index);
    },
    [navigateToStep]
  );

  const goNext = useCallback(() => {
    navigateToStep(displayStepIndex + 1);
  }, [navigateToStep, displayStepIndex]);

  const goBack = useCallback(() => {
    navigateToStep(displayStepIndex - 1);
  }, [navigateToStep, displayStepIndex]);

  const isDemoForStep = useCallback(
    (stepId: string) => {
      if (!active) return false;
      const step = steps.find((s) => s.id === stepId);
      if (!step) return false;
      if (isFinishStep) {
        return Boolean(step.href && pathnameMatchesOnboardingStep(pathname, step));
      }
      return currentStepId === stepId && isLivePreviewStep;
    },
    [active, currentStepId, isFinishStep, isLivePreviewStep, pathname, steps]
  );

  const coachPaddingClass = showCoach
    ? "pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 md:pr-84"
    : "";

  const value = useMemo<SalesOnboardingContextValue>(
    () => ({
      active,
      steps,
      stepIndex: displayStepIndex,
      currentStep,
      currentStepId,
      isWelcomeStep,
      isFinishStep,
      isLivePreviewStep,
      showCoach,
      navLocked,
      coachPaddingClass,
      setStepIndex,
      goNext,
      goBack,
      isDemoForStep,
      displayName,
    }),
    [
      active,
      coachPaddingClass,
      currentStep,
      currentStepId,
      displayName,
      displayStepIndex,
      goBack,
      goNext,
      isDemoForStep,
      isFinishStep,
      isLivePreviewStep,
      isWelcomeStep,
      navLocked,
      setStepIndex,
      showCoach,
      steps,
    ]
  );

  return (
    <SalesOnboardingContext.Provider value={value}>{children}</SalesOnboardingContext.Provider>
  );
}

export function useSalesOnboarding() {
  const ctx = useContext(SalesOnboardingContext);
  if (!ctx) {
    throw new Error("useSalesOnboarding must be used within SalesOnboardingProvider");
  }
  return ctx;
}

export function useSalesOnboardingOptional() {
  return useContext(SalesOnboardingContext);
}

/** false podczas SSR i pierwszego hydrate — unika mismatch w menu i tour chrome. */
export function useSalesNavLocked(): boolean {
  const ctx = useSalesOnboardingOptional();
  const hydrated = useSalesOnboardingHydrated();
  return hydrated && Boolean(ctx?.navLocked);
}

export function useSalesCoachPaddingClass(): string {
  const ctx = useSalesOnboardingOptional();
  const hydrated = useSalesOnboardingHydrated();
  return hydrated ? (ctx?.coachPaddingClass ?? "") : "";
}

export function useSalesOnboardingDemo(stepId: string) {
  const ctx = useSalesOnboardingOptional();
  return Boolean(ctx?.isDemoForStep(stepId));
}
