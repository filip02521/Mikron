import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-slate-200/80 bg-[var(--card)] shadow-[var(--shadow-card-elevated)]",
        padding && "p-6 sm:p-7",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  leading,
  inset = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-slate-100 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4",
        inset ? "px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6" : "mb-6 pb-5"
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-3 sm:max-w-[min(100%,42rem)] sm:flex-1">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-snug text-slate-500 sm:leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&_a]:inline-flex [&_a]:items-center">
          {action}
        </div>
      ) : null}
    </div>
  );
}
