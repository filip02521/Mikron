import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { ONTIME_APP_NAME, ONTIME_COMPANY } from "@/lib/ui/ontime-brand";
import { cn } from "@/lib/cn";

/** Logo + nazwa + hasło — ekrany logowania i konfiguracji. */
export function AuthBrandHeader({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <AppBrandMark
        size="lg"
        variant="light"
        className={cn(
          "mx-auto mb-3 bg-gradient-to-br from-indigo-600 to-sky-600 shadow-sky-700/25 ring-sky-500/35 sm:mb-4",
          "motion-safe:transition-transform motion-safe:hover:scale-[1.02]",
          markClassName
        )}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/90">
        {ONTIME_COMPANY}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]"
        aria-label={ONTIME_APP_NAME}
      >
        <span className="text-slate-800">On</span>
        <span className="text-indigo-600">Time</span>
      </p>
    </div>
  );
}
