"use client";

import { useSalesOnboardingOptional } from "@/components/sales/SalesOnboardingContext";
import { cn } from "@/lib/cn";

export function SalesOnboardingTourBanner() {
  const onboarding = useSalesOnboardingOptional();
  if (!onboarding?.navLocked) return null;

  const isDemo = onboarding.isLivePreviewStep;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-3 mb-4 border border-indigo-300/90 bg-indigo-600 px-3 py-3 text-white shadow-md sm:-mx-6 sm:px-4 md:top-2 md:rounded-md"
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-snug">
        Trwa wprowadzenie do OnTime
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-100">
        <span className="hidden md:inline">
          Przejdź tour w{" "}
          <strong className="font-semibold text-white">panelu po prawej stronie</strong> — używaj
          przycisków Dalej i Wstecz. Menu boczne jest na razie wyłączone.
        </span>
        <span className="md:hidden">
          Przejdź tour w{" "}
          <strong className="font-semibold text-white">panelu na dole ekranu</strong> — używaj
          Dalej i Wstecz. Dolne menu jest na razie wyłączone.
        </span>
        {isDemo ? (
          <span className="mt-1 block text-indigo-200/95">
            Widzisz przykładowe dane — po zakończeniu touru pojawią się Twoje wpisy.
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function SalesOnboardingContentGuard({ children }: { children: React.ReactNode }) {
  const onboarding = useSalesOnboardingOptional();
  if (!onboarding?.navLocked) return children;

  return (
    <div className="pointer-events-none select-none" aria-hidden={false}>
      {children}
    </div>
  );
}
