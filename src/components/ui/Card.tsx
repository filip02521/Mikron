import { cn } from "@/lib/cn";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";

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
        "rounded-[var(--radius-panel)] border border-slate-200 bg-[var(--card)] shadow-[var(--shadow-card)]",
        padding && "p-5 sm:p-6",
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
  hint,
  hintAriaLabel = "O tej sekcji",
  action,
  leading,
  inset = false,
  density = "default",
  actionAlign = "stacked",
  titleClassName,
  descriptionClassName,
  className,
}: {
  title: string;
  description?: string;
  /** Podpowiedź przy tytule zamiast osobnego opisu. */
  hint?: string;
  hintAriaLabel?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
  inset?: boolean;
  /** Ciaśniejszy nagłówek — panel handlowca / listy. `micro` = chrome Kreatora. */
  density?: "default" | "compact" | "micro";
  /** Przy `compact` + opis: `stacked` = akcja pod opisem, `inline` = po prawej od tytułu. */
  actionAlign?: "inline" | "stacked";
  titleClassName?: string;
  descriptionClassName?: string;
  className?: string;
}) {
  const stackAction =
    (density === "compact" || density === "micro") &&
    Boolean(description) &&
    Boolean(action) &&
    actionAlign !== "inline";

  const titleClass = cn(
    density === "micro"
      ? "text-[0.8125rem] font-semibold tracking-tight text-slate-900"
      : density === "compact"
        ? "text-base font-semibold tracking-tight text-slate-900"
        : "text-base font-semibold tracking-[-0.01em] text-slate-900",
    titleClassName
  );

  const descriptionClass = cn(
    density === "micro"
      ? "mt-0.5 text-[0.6875rem] leading-snug text-slate-500"
      : density === "compact"
        ? "mt-1 text-xs leading-relaxed text-slate-500"
        : "mt-1 text-sm leading-relaxed text-slate-600",
    descriptionClassName
  );

  const actionClass =
    "flex flex-wrap items-center gap-2 [&_a]:inline-flex [&_a]:items-center";

  const paddingClass = inset
    ? density === "micro"
      ? "px-3 py-1.5 sm:px-4 lg:px-5"
      : density === "compact"
        ? "px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-4"
        : "px-5 py-4 sm:px-6"
    : "mb-5 pb-4";

  const titleNode = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <h2 className={titleClass}>{title}</h2>
      {hint ? (
        <HelpHintBubble
          message={hint}
          tone="slate"
          size={density === "micro" ? "sm" : "md"}
          ariaLabel={hintAriaLabel}
        />
      ) : null}
    </div>
  );

  if (stackAction) {
    return (
      <div className={cn("border-b border-slate-100", paddingClass, className)}>
        <div className="flex w-full min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className="min-w-0 flex-1">
            {titleNode}
            {description ? <p className={descriptionClass}>{description}</p> : null}
            <div className={cn("mt-2", actionClass)}>{action}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-b border-slate-100", paddingClass, className)}>
      <div className="flex w-full min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{titleNode}</div>
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
