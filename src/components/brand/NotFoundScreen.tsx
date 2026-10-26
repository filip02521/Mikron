import { AuthBrandHeader } from "@/components/auth/AuthBrandHeader";
import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import {
  NotFoundActions,
  NotFoundAttemptedPath,
} from "@/components/brand/NotFoundActions";
import { ONTIME_AUTH_FOOTER, ONTIME_TAGLINE } from "@/lib/ui/ontime-brand";
import { cn } from "@/lib/cn";

export type NotFoundScreenProps = {
  homeHref: string;
  homeLabel: string;
  /** Drugi link — np. logowanie dla gościa albo panel dla zalogowanego. */
  secondaryHref?: string;
  secondaryLabel?: string;
};

/**
 * Pełny moment 404 wewnątrz AppShell: marka OnTime jako sygnał wiodący,
 * spokojny komunikat i kontekstowe CTA.
 */
export function NotFoundScreen({
  homeHref,
  homeLabel,
  secondaryHref,
  secondaryLabel,
}: NotFoundScreenProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-lg flex-col justify-center",
        "min-h-[min(36rem,calc(100dvh-7.5rem))]",
        "px-1 py-6 sm:py-10"
      )}
    >
      {/* Moment marki bez animacji wejścia: treść widoczna od razu (DESIGN.md → Ruch). */}
      <div className="relative z-[1]">
        <AuthBrandHeader className="mb-5 sm:mb-6" />

        <p className="mb-5 text-center text-xs leading-relaxed text-slate-500 sm:mb-6">
          {ONTIME_TAGLINE}
        </p>

        <div
          className={cn(
            "relative overflow-hidden rounded-[var(--radius-panel)] border border-slate-200",
            "bg-[var(--card)] p-6 text-center shadow-[var(--shadow-card-elevated)] sm:p-8"
          )}
        >
          <BrandCardAccent className="absolute -right-6 -top-6 h-36 w-44 text-indigo-600" />

          <div className="relative z-[1]">
            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900">
              Nie znaleziono strony
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-slate-600">
              Ten adres nie prowadzi do żadnego widoku w OnTime. Link mógł się
              zmienić, wygasnąć albo zawierać literówkę.
            </p>

            <NotFoundAttemptedPath />

            <div className="mt-6">
              <NotFoundActions
                homeHref={homeHref}
                homeLabel={homeLabel}
                secondaryHref={secondaryHref}
                secondaryLabel={secondaryLabel}
              />
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">{ONTIME_AUTH_FOOTER}</p>
      </div>
    </div>
  );
}
