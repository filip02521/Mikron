import { cn } from "@/lib/cn";

export type DailyPanelSubsectionTone = "default" | "overdue";

/** Nagłówek podsekcji wewnątrz karty panelu dziennego (np. prośby handlowców). */
export function DailyPanelSubsectionBar({
  title,
  description,
  action,
  tone = "default",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: DailyPanelSubsectionTone;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 sm:px-5",
        tone === "overdue"
          ? "border-amber-100 bg-amber-50/50"
          : "border-slate-100 bg-slate-50/70"
      )}
    >
      <div className="min-w-0">
        <h4
          className={cn(
            "text-sm font-semibold",
            tone === "overdue" ? "text-amber-950" : "text-slate-900"
          )}
        >
          {title}
        </h4>
        {description ? (
          <p
            className={cn(
              "mt-0.5 text-xs leading-relaxed",
              tone === "overdue" ? "text-amber-900/80" : "text-slate-500"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
