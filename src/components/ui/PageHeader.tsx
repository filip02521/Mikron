import Link from "next/link";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { pageTitleClass } from "@/lib/ui/ontime-theme";

/**
 * Nagłówek strony — leży na tle (`canvas`), nie w karcie, bez kafla ikony (DESIGN.md → Layout, Anatomia ekranu).
 * Kolejność: link powrotu, tytuł z pomocą, opis; akcje po prawej (najwyżej jedna główna).
 */
export function PageHeader({
  title,
  description,
  hint,
  hintAriaLabel = "O tej stronie",
  help,
  back,
  actions,
  badge,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Podpowiedź przy tytule zamiast osobnego opisu. */
  hint?: string;
  hintAriaLabel?: string;
  /** Własny przycisk pomocy przy tytule (np. `HelpPopover`). */
  help?: React.ReactNode;
  /** Link powrotu nad tytułem, np. { href: "/admin", label: "Administracja" }. */
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5" + (className ? ` ${className}` : "")
      }
    >
      <div className="min-w-0 space-y-1.5">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center sm:min-h-8 gap-1 text-[0.8125rem] font-medium text-slate-600 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
          >
            <BackChevron className="text-slate-500" />
            {back.label}
          </Link>
        ) : null}
        {badge}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h1 className={pageTitleClass}>{title}</h1>
          {help}
          {hint ? <HelpHintBubble message={hint} tone="slate" size="md" ariaLabel={hintAriaLabel} /> : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-slate-600">{description}</p>
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
