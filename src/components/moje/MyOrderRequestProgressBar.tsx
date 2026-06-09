import type { MyOrderRequestProgressTrack } from "@/lib/orders/my-order-request-progress";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

const accentClass = {
  default: {
    done: "bg-indigo-600 text-white",
    current: "bg-indigo-600 text-white ring-2 ring-indigo-200",
    upcoming: "bg-slate-200 text-slate-500",
    connectorDone: "bg-indigo-300",
    connectorUpcoming: "bg-slate-200",
    labelCurrent: "text-indigo-900",
    labelDone: "text-slate-700",
    labelUpcoming: "text-slate-400",
  },
  informacja: {
    done: "bg-violet-600 text-white",
    current: "bg-violet-600 text-white ring-2 ring-violet-200",
    upcoming: "bg-violet-100 text-violet-400",
    connectorDone: "bg-violet-300",
    connectorUpcoming: "bg-violet-100",
    labelCurrent: "text-violet-900",
    labelDone: "text-violet-800/90",
    labelUpcoming: "text-violet-400",
  },
} as const;

export function MyOrderRequestProgressBar({
  track,
  className,
}: {
  track: MyOrderRequestProgressTrack;
  className?: string;
}) {
  const palette = accentClass[track.accent];

  return (
    <nav
      aria-label="Postęp prośby"
      className={cn("rounded-md border border-slate-200/80 bg-white/80 px-2 py-2.5 sm:px-3", className)}
    >
      <ol className="flex items-start gap-0">
        {track.steps.map((step, index) => {
          const isLast = index === track.steps.length - 1;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    step.state === "done" && palette.done,
                    step.state === "current" && palette.current,
                    step.state === "upcoming" && palette.upcoming
                  )}
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  {step.state === "done" ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "max-w-[5.5rem] text-center text-[10px] font-medium leading-tight sm:max-w-none sm:text-[11px]",
                    salesTypography.rowMeta,
                    step.state === "current" && palette.labelCurrent,
                    step.state === "done" && palette.labelDone,
                    step.state === "upcoming" && palette.labelUpcoming
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-3 h-0.5 min-w-[0.35rem] flex-1 rounded-full",
                    step.state === "done" ? palette.connectorDone : palette.connectorUpcoming
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
