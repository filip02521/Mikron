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
        "rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-[var(--shadow-card)]",
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
  inset = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 border-b border-slate-100",
        inset ? "px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6" : "mb-6 pb-5"
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
