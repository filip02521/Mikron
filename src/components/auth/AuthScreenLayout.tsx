import { AuthQuotePanel } from "@/components/auth/AuthQuotePanel";
import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { cn } from "@/lib/cn";

export function AuthScreenLayout({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-dvh overflow-x-hidden", className)}>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 lg:flex lg:w-[min(42%,28rem)] lg:flex-col lg:px-12 lg:py-14 xl:px-16">
        <div
          className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl motion-safe:animate-auth-float"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-1/4 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl motion-safe:animate-auth-float motion-safe:[animation-delay:1.2s]"
          aria-hidden
        />
        <AuthQuotePanel className="relative z-10 flex-1" />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div
          className={cn(
            "mx-auto flex w-full max-w-md flex-1 flex-col justify-start sm:justify-center",
            "px-4 py-6",
            "pt-[max(1rem,env(safe-area-inset-top))]",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "sm:px-6 sm:py-10"
          )}
        >
          <div className="auth-enter w-full">
            <header className="mb-5 text-center sm:mb-6 lg:mb-8">
              <AppBrandMark
                size="lg"
                className="mx-auto mb-3 bg-indigo-600 shadow-indigo-600/25 ring-indigo-500/30 sm:mb-4 motion-safe:transition-transform motion-safe:hover:scale-[1.02]"
              />
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500">
                  {subtitle}
                </p>
              ) : null}
            </header>

            <AuthQuotePanel compact className="mb-5 lg:hidden" />

            <div className="auth-card-enter rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xl shadow-slate-200/40 backdrop-blur-sm sm:p-8">
              {children}
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-slate-400 lg:hidden">
              Mikran · System Dostaw
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
