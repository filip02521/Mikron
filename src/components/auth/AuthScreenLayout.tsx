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
import { cn } from "@/lib/cn";

function AuthAsidePanel() {
  if (isAuthVisualVariant('bridge')) {
    return (
      <>
        <div className="auth-aside-bg pointer-events-none absolute inset-0 overflow-hidden">
          <AuthAsideBackdrop />
        </div>
        <AuthSplitBridge />
      </>
    );
  }

  if (isAuthVisualVariant('original')) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AuthAsideBackdrop />
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
    <div className={cn("flex min-h-dvh w-full max-w-full overflow-x-hidden", className)}>
      <aside
        className={cn(
          "relative hidden overflow-hidden bg-indigo-800 lg:flex lg:w-[min(42%,28rem)] lg:flex-col lg:px-12 lg:py-14 xl:px-16",
          isAuthVisualVariant('bridge') && "overflow-visible"
        )}
      >
        <AuthAsidePanel />
        <AuthQuotePanel className="relative z-10 flex-1" />
      </aside>

      <main
        className={cn(
          "relative isolate flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain",
          "scroll-smooth [scroll-padding-top:max(0.75rem,env(safe-area-inset-top))] [scroll-padding-bottom:max(1rem,env(safe-area-inset-bottom))]",
          minimal ? "bg-white" : "bg-slate-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {isAuthVisualVariant('bridge') ? <AuthMainBridgeFade /> : null}
          {minimal ? <AuthMainBackdropGeometric /> : <AuthMainBackdropRich />}
        </div>
        <div
          className={cn(
            // Bardzo szeroki ekran: formularz bliżej panelu marki, nie w środku pustej połowy.
            "relative z-[1] mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col 2xl:ml-[14%] 2xl:mr-auto",
            "px-4 py-5",
            "pt-[max(0.75rem,env(safe-area-inset-top))]",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "sm:px-6 sm:py-8"
          )}
        >
          <div className="auth-enter relative z-[1] my-auto w-full min-h-0 min-w-0 max-w-full">
            <header className="mb-4 sm:mb-5 lg:mb-8">
              <AuthBrandHeader className="mb-4 sm:mb-5 lg:hidden" />
              <div className="text-center">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </header>

            <div className="auth-card-enter min-h-0 min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-[var(--shadow-card-elevated)] sm:p-6">
              {children}
            </div>

            {hideCompactQuote ? null : (
              <AuthQuotePanel compact className="mt-3 lg:hidden" />
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
