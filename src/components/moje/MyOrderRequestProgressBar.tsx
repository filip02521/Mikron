import type { MyOrderRequestProgressTrack } from "@/lib/orders/my-order-request-progress";
import { cn } from "@/lib/cn";

const accentClass = {
  default: {
    done: "bg-indigo-600 text-white",
    current: "bg-indigo-600 text-white ring-1 ring-indigo-200",
    upcoming: "bg-slate-200 text-slate-500",
    cancelled: "bg-red-100 text-red-500 ring-1 ring-red-200",
    connectorDone: "bg-indigo-300",
    connectorUpcoming: "bg-slate-200",
    connectorCancelled: "bg-red-200",
    labelCurrent: "text-indigo-900",
    labelDone: "text-slate-700",
    labelUpcoming: "text-slate-400",
    labelCancelled: "text-red-600/80",
  },
  informacja: {
    done: "bg-violet-600 text-white",
    current: "bg-violet-600 text-white ring-1 ring-violet-200",
    upcoming: "bg-violet-100 text-violet-400",
    cancelled: "bg-red-100 text-red-500 ring-1 ring-red-200",
    connectorDone: "bg-violet-300",
    connectorUpcoming: "bg-violet-100",
    connectorCancelled: "bg-red-200",
    labelCurrent: "text-violet-900",
    labelDone: "text-violet-800/90",
    labelUpcoming: "text-violet-400",
    labelCancelled: "text-red-600/80",
  },
  archive: {
    done: "bg-slate-500 text-white",
    current: "bg-slate-500 text-white ring-1 ring-slate-300",
    upcoming: "bg-slate-200 text-slate-400",
    cancelled: "bg-red-100 text-red-500 ring-1 ring-red-200",
    connectorDone: "bg-slate-400",
    connectorUpcoming: "bg-slate-200",
    connectorCancelled: "bg-red-200",
    labelCurrent: "text-slate-700",
    labelDone: "text-slate-600",
    labelUpcoming: "text-slate-400",
    labelCancelled: "text-red-600/80",
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
      className={cn("px-1 py-1", className)}
    >
      <ol className="flex items-start gap-0">
        {track.steps.map((step, index) => {
          const isLast = index === track.steps.length - 1;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums",
                    step.state === "done" && palette.done,
                    step.state === "current" && palette.current,
                    step.state === "upcoming" && palette.upcoming,
                    step.state === "cancelled" && palette.cancelled
                  )}
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  {step.state === "done" ? "✓" : step.state === "cancelled" ? "×" : index + 1}
                </span>
                <span
                  className={cn(
                    "max-w-[5rem] text-center text-[9px] font-medium leading-tight sm:max-w-none sm:text-[10px]",
                    step.state === "current" && palette.labelCurrent,
                    step.state === "done" && palette.labelDone,
                    step.state === "upcoming" && palette.labelUpcoming,
                    step.state === "cancelled" && palette.labelCancelled
                  )}
                >
                  {step.label}
                </span>
                {step.date ? (
                  <span
                    className={cn(
                      "text-[8px] tabular-nums leading-tight text-slate-400 sm:text-[9px]",
                      step.state === "current" && "text-slate-500",
                      step.state === "done" && "text-slate-400",
                      step.state === "cancelled" && "text-red-400/70"
                    )}
                  >
                    {step.date}
                  </span>
                ) : null}
              </div>
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-2 h-px min-w-[0.3rem] flex-1",
                    step.state === "done"
                      ? palette.connectorDone
                      : step.state === "cancelled"
                        ? palette.connectorCancelled
                        : palette.connectorUpcoming
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
