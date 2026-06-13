"use client";

import {
  useSalesNavLocked,
  useSalesOnboardingOptional,
} from "@/components/sales/SalesOnboardingContext";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { cn } from "@/lib/cn";

export function SalesOnboardingTourBanner() {
  const onboarding = useSalesOnboardingOptional();
  const navLocked = useSalesNavLocked();
  if (!navLocked || !onboarding) return null;

  const isDemo = onboarding.isLivePreviewStep;
  const stepTitle = onboarding.currentStep.title;

  return (
    <SystemNotice
      variant="tour"
      sticky
      className={cn("-mx-3 sm:-mx-4 md:rounded-md")}
      title="Trwa wprowadzenie do OnTime"
      description={
        <>
          <span className="block font-medium text-white/95">
            Krok: {stepTitle}
          </span>
          <span className="mt-1 hidden md:block">
            Przechodź tour w{" "}
            <strong className="font-semibold text-white">panelu po prawej</strong>. Używaj „Dalej”
            i „Wstecz”. Menu boczne jest na razie wyłączone — strona służy tylko do podglądu.
          </span>
          <span className="mt-1 md:hidden">
            Przechodź tour w{" "}
            <strong className="font-semibold text-white">panelu na dole ekranu</strong>. Używaj
            „Dalej” i „Wstecz”. Dolne menu jest na razie wyłączone.
          </span>
          {isDemo ? (
            <span className="mt-1 block text-indigo-200/95">
              Widzisz przykładowe dane tej zakładki. Po zakończeniu touru pojawią się Twoje wpisy.
            </span>
          ) : null}
        </>
      }
    />
  );
}

export function SalesOnboardingContentGuard({ children }: { children: React.ReactNode }) {
  const navLocked = useSalesNavLocked();
  if (!navLocked) return children;

  return (
    <div
      className={cn(
        "select-none",
        "[&_a]:pointer-events-none [&_a]:cursor-default"
      )}
    >
      {children}
    </div>
  );
}
