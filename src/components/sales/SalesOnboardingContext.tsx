"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  resolveTourStepIndexFromPathname,
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
  const [stepIndex, setStepIndexState] = useState(0);
  const stepIndexRef = useRef(stepIndex);
  const skipPathSyncRef = useRef(false);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  const currentStep = steps[stepIndex] ?? steps[0]!;
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
      skipPathSyncRef.current = true;
      setStepIndexState(clamped);
      const target = stepPathnameForStep(step);
      if (target && target !== pathname) {
        router.push(target);
      }
    },
    [pathname, role, router, steps]
  );

  useLayoutEffect(() => {
    if (!active || isTourStarted(stepIndexRef.current)) return;
    try {
      if (sessionStorage.getItem(TOUR_STARTED_STORAGE_KEY) !== "1") return;
    } catch {
      return;
    }
    const matched = resolveTourStepIndexFromPathname(steps, pathname, null);
    if (matched != null && matched > 0) {
      setStepIndexState(matched);
    }
  }, [active, pathname, steps]);

  useEffect(() => {
    if (skipPathSyncRef.current) {
      skipPathSyncRef.current = false;
      return;
    }
    if (!active || !isTourStarted(stepIndexRef.current)) return;

    const matched = resolveTourStepIndexFromPathname(
      steps,
      pathname,
      stepIndexRef.current
    );
    if (matched != null && matched !== stepIndexRef.current) {
      setStepIndexState(matched);
    }
  }, [active, pathname, steps]);

  const setStepIndex = useCallback(
    (index: number) => {
      navigateToStep(index);
    },
    [navigateToStep]
  );

  const goNext = useCallback(() => {
    navigateToStep(stepIndex + 1);
  }, [navigateToStep, stepIndex]);

  const goBack = useCallback(() => {
    navigateToStep(stepIndex - 1);
  }, [navigateToStep, stepIndex]);

  const isDemoForStep = useCallback(
    (stepId: string) => active && currentStepId === stepId && isLivePreviewStep,
    [active, currentStepId, isLivePreviewStep]
  );

  const coachPaddingClass = showCoach
    ? "pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 md:pr-84"
    : "";

  const value = useMemo<SalesOnboardingContextValue>(
    () => ({
      active,
      steps,
      stepIndex,
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
      goBack,
      goNext,
      isDemoForStep,
      isFinishStep,
      isLivePreviewStep,
      isWelcomeStep,
      navLocked,
      setStepIndex,
      showCoach,
      stepIndex,
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

function useSalesOnboardingHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
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
