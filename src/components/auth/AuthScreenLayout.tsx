import { AuthBrandHeader } from "@/components/auth/AuthBrandHeader";
import { AuthQuotePanel } from "@/components/auth/AuthQuotePanel";
import {
  AuthAsideBackdrop,
  AuthAsideBackdropMinimal,
  AuthMainBackdropGeometric,
  AuthMainBackdropRich,
} from "@/components/auth/AuthBackgroundArt";
import { AuthMainBridgeFade, AuthSplitBridge } from "@/components/auth/AuthSplitBridge";
import { isAuthVisualVariant } from "@/components/auth/auth-visual-variant";
import { ONTIME_AUTH_FOOTER } from "@/lib/ui/ontime-brand";
import { cn } from "@/lib/cn";

function AuthAsideBlurOrbs() {
  return (
    <>
      <div
        className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl motion-safe:animate-auth-float"
        aria-hidden
      />
      <div
        className="absolute -right-16 bottom-1/4 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl motion-safe:animate-auth-float motion-safe:[animation-delay:1.2s]"
        aria-hidden
      />
    </>
  );
}

function AuthAsidePanel() {
  if (isAuthVisualVariant('bridge')) {
    return (
      <>
        <div className="auth-aside-bg pointer-events-none absolute inset-0 overflow-hidden">
          <AuthAsideBackdrop />
          <AuthAsideBlurOrbs />
        </div>
        <AuthSplitBridge />
      </>
    );
  }

  if (isAuthVisualVariant('original')) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AuthAsideBackdrop />
        <AuthAsideBlurOrbs />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AuthAsideBackdropMinimal />
    </div>
  );
}

export function AuthScreenLayout({
  title,
  subtitle,
  children,
  className,
  hideCompactQuote = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Ukryj cytat na mobile — np. po wygaśnięciu sesji, gdy liczy się szybki powrót. */
  hideCompactQuote?: boolean;
}) {
  const minimal = isAuthVisualVariant('minimal');

  return (
    <div className={cn("flex min-h-dvh overflow-x-hidden", className)}>
      <aside
        className={cn(
          "relative hidden overflow-hidden bg-gradient-to-br from-indigo-800 via-sky-900 to-slate-950 lg:flex lg:w-[min(42%,28rem)] lg:flex-col lg:px-12 lg:py-14 xl:px-16",
          isAuthVisualVariant('bridge') && "overflow-visible"
        )}
      >
        <AuthAsidePanel />
        <AuthQuotePanel className="relative z-10 flex-1" />
      </aside>

      <main
        className={cn(
          "relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
          "scroll-smooth [scroll-padding-top:max(0.75rem,env(safe-area-inset-top))] [scroll-padding-bottom:max(1rem,env(safe-area-inset-bottom))]",
          minimal
            ? "bg-white"
            : "bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/50"
        )}
      >
        {isAuthVisualVariant('bridge') ? <AuthMainBridgeFade /> : null}
        {minimal ? <AuthMainBackdropGeometric /> : <AuthMainBackdropRich />}
        <div
          className={cn(
            "mx-auto flex w-full max-w-md flex-1 flex-col",
            "px-4 py-5",
            "pt-[max(0.75rem,env(safe-area-inset-top))]",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "sm:px-6 sm:py-8"
          )}
        >
          <div className="auth-enter relative z-[1] my-auto w-full min-h-0">
            <header className="mb-4 sm:mb-5 lg:mb-8">
              <AuthBrandHeader className="mb-4 sm:mb-5" />
              <div className="text-center">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </header>

            {hideCompactQuote ? null : (
              <AuthQuotePanel compact className="mb-3 max-sm:mb-2.5 lg:hidden" />
            )}

            <div className="auth-card-enter min-h-0 rounded-lg border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-200/40 backdrop-blur-sm sm:p-6">
              {children}
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-slate-400 sm:mt-5 lg:hidden">
              {ONTIME_AUTH_FOOTER}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
