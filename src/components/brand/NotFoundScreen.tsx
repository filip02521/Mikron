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
      {/* Atmosfera — subtelne orby w tonacji marki, bez osobnej „kartkowej” scenografii */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-indigo-200/25 blur-3xl motion-safe:animate-auth-float" />
        <div className="absolute -right-10 bottom-16 h-40 w-40 rounded-full bg-sky-200/30 blur-3xl motion-safe:animate-auth-float-slow" />
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-indigo-100/20 blur-3xl motion-safe:animate-auth-float-center" />
      </div>

      <div className="auth-enter relative z-[1]">
        <AuthBrandHeader className="mb-5 sm:mb-6" />

        <p className="mb-4 text-center text-xs leading-relaxed text-slate-400 sm:mb-5">
          {ONTIME_TAGLINE}
        </p>

        <div
          className={cn(
            "auth-card-enter relative overflow-hidden rounded-lg border border-slate-200/80",
            "bg-white/95 p-6 text-center shadow-[var(--shadow-card-elevated)] backdrop-blur-sm sm:p-8"
          )}
        >
          <BrandCardAccent className="absolute -right-6 -top-6 h-36 w-44 text-indigo-600" />

          {/* Znak 404 — tło typograficzne, nie konkuruje z marką */}
          <span
            className="pointer-events-none absolute inset-x-0 top-3 select-none text-center text-[4.5rem] font-bold leading-none tracking-tighter text-slate-900/[0.04] sm:top-2 sm:text-[5.5rem]"
            aria-hidden
          >
            404
          </span>

          <div className="relative z-[1]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700/90">
              Strona niedostępna
            </p>

            <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Nie znaleziono strony
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
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

        <p className="mt-5 text-center text-xs text-slate-400">{ONTIME_AUTH_FOOTER}</p>
      </div>
    </div>
  );
}
