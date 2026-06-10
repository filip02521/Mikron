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
  density = "default",
  actionAlign = "stacked",
  titleClassName,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
  inset?: boolean;
  /** Ciaśniejszy nagłówek — panel handlowca / listy. */
  density?: "default" | "compact";
  /** Przy `compact` + opis: `stacked` = akcja pod opisem, `inline` = po prawej od tytułu. */
  actionAlign?: "inline" | "stacked";
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  const stackAction =
    density === "compact" &&
    Boolean(description) &&
    Boolean(action) &&
    actionAlign !== "inline";

  const titleClass = cn(
    density === "compact"
      ? "text-base font-semibold tracking-tight text-slate-900"
      : "text-lg font-semibold tracking-tight text-slate-900 lg:text-xl",
    titleClassName
  );

  const descriptionClass = cn(
    density === "compact"
      ? "mt-1 text-xs leading-relaxed text-slate-500"
      : "mt-1.5 text-sm leading-snug text-slate-500 sm:leading-relaxed lg:text-base lg:leading-relaxed",
    descriptionClassName
  );

  const actionClass =
    "flex flex-wrap items-center gap-2 [&_a]:inline-flex [&_a]:items-center";

  const paddingClass = inset
    ? density === "compact"
      ? "px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-4"
      : "px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6 lg:px-8 lg:pb-6 lg:pt-7"
    : "mb-6 pb-5";

  if (stackAction) {
    return (
      <div className={cn("border-b border-slate-100", paddingClass)}>
        <div className="flex w-full min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 className={titleClass}>{title}</h2>
            <p className={descriptionClass}>{description}</p>
            <div className={cn("mt-2", actionClass)}>{action}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-b border-slate-100", paddingClass)}>
      <div className="flex w-full min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h2 className={cn("min-w-0 flex-1", titleClass)}>{title}</h2>
            {action ? (
              <div className={cn("max-w-full shrink-0 justify-end sm:max-w-[min(100%,28rem)]", actionClass)}>
                {action}
              </div>
            ) : null}
          </div>
          {description ? <p className={descriptionClass}>{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
