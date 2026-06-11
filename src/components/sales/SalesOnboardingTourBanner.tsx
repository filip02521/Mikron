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

  return (
    <SystemNotice
      variant="tour"
      sticky
      className={cn("-mx-3 sm:-mx-4 md:rounded-md")}
      title="Trwa wprowadzenie do OnTime"
      description={
        <>
          <span className="hidden md:inline">
            Przechodź tour w{" "}
            <strong className="font-semibold text-white">panelu po prawej</strong>. Używaj „Dalej”
            i „Wstecz”. Menu boczne jest na razie wyłączone.
          </span>
          <span className="md:hidden">
            Przechodź tour w{" "}
            <strong className="font-semibold text-white">panelu na dole ekranu</strong>. Używaj
            „Dalej” i „Wstecz”. Dolne menu jest na razie wyłączone.
          </span>
          {isDemo ? (
            <span className="mt-1 block text-indigo-200/95">
              Widzisz przykładowe dane. Po zakończeniu touru pojawią się Twoje wpisy.
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
    <div className="pointer-events-none select-none" aria-hidden={false}>
      {children}
    </div>
  );
}
