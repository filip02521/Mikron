import { HelpHintBubble } from "@/components/ui/HelpHintBubble";

export function PageHeader({
  title,
  description,
  hint,
  hintAriaLabel = "O tej stronie",
  actions,
  badge,
}: {
  title: string;
  description?: string;
  /** Podpowiedź przy tytule zamiast osobnego opisu. */
  hint?: string;
  hintAriaLabel?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div className="min-w-0 space-y-2">
        {badge}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem] sm:leading-tight">
            {title}
          </h1>
          {hint ? (
            <HelpHintBubble message={hint} tone="slate" size="md" ariaLabel={hintAriaLabel} />
          ) : null}
        </div>
        {description ? (
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&_a]:flex-1 [&_button]:min-h-11 sm:[&_a]:flex-none sm:[&_button]:min-h-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
