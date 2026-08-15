import { Badge } from "@/components/ui/Badge";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  zdEstimateHostBadgeLabel,
  zdEstimateHostStripDetail,
  zdEstimatePageFlowSteps,
  zdEstimatePageLead,
} from "@/lib/orders/zd-estimate-ui-copy";

/** @deprecated Alias — użyj ZdEstimateHostStrip. */
export type ZdEstimatePageIntroHost = ZdEstimateHostStrip;

/**
 * Nagłówek Kreatora ZD na stronie (nie w oknie loadingu).
 * Tytuł + kroki flow + badge hosta; szczegóły tylko w HelpHint.
 */
export function ZdEstimatePageIntro({
  title = "Kreator ZD",
  /** Krótki lead pod tytułem — domyślnie kanoniczny zdEstimatePageLead(). */
  lead,
  /** Kontekst wejścia (np. dostawca z Dziś / podsumowania). */
  contextLabel,
  hint,
  hintAriaLabel = "O kreatorze ZD",
  host = null,
  hostPlaceholder = false,
}: {
  title?: string;
  lead?: string;
  contextLabel?: string | null;
  hint?: string;
  hintAriaLabel?: string;
  host?: ZdEstimateHostStrip | null;
  hostPlaceholder?: boolean;
}) {
  const hostConfigured = host?.configured === true;
  const hostDetail =
    hostConfigured && host
      ? zdEstimateHostStripDetail({
          isLive: host.isLive,
          salesEndFromFs: host.salesEndFromFs === true,
          salesEndKeyFormatted: host.salesEndKeyFormatted ?? null,
        })
      : null;

  const combinedHint =
    [hint, hostDetail].filter(Boolean).join("\n\n") || undefined;

  const showHintSlot = Boolean(combinedHint) || hostPlaceholder;
  const leadText = lead ?? zdEstimatePageLead();
  const flowSteps = zdEstimatePageFlowSteps();

  return (
    <header className="border-b border-slate-100/90 pb-4 sm:pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl sm:leading-tight">
                {title}
              </h1>
              {showHintSlot ? (
                combinedHint ? (
                  <HelpHintBubble
                    message={combinedHint}
                    tone="slate"
                    size="md"
                    ariaLabel={hintAriaLabel}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="inline-block size-5 shrink-0 rounded-full bg-slate-100 motion-safe:animate-pulse"
                  />
                )
              ) : null}
            </div>
            {contextLabel ? (
              <p className="text-xs font-medium text-indigo-800/90 sm:text-[13px]">
                {contextLabel}
              </p>
            ) : null}
            <p className="max-w-2xl text-sm leading-snug text-slate-600">
              {leadText}
            </p>
          </div>

          <ol
            aria-label="Kroki kreatora"
            className="flex flex-wrap items-center gap-1.5"
          >
            {flowSteps.map((step, index) => (
              <li key={step.id} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="text-[10px] font-medium text-slate-300"
                  >
                    →
                  </span>
                ) : null}
                <span
                  title={step.hint}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium leading-none sm:text-xs",
                    "border-slate-200/90 bg-slate-50/90 text-slate-700"
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-4 items-center justify-center rounded-sm bg-white text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/90"
                  >
                    {index + 1}
                  </span>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {hostConfigured && host ? (
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end sm:pt-0.5">
            <span title={hostDetail ?? undefined}>
              <Badge
                variant={host.isLive ? "warning" : "success"}
                className={cn(
                  "tabular-nums tracking-wide",
                  host.isLive && "ring-1 ring-amber-300/70"
                )}
              >
                {zdEstimateHostBadgeLabel({
                  isLive: host.isLive,
                  port: host.port,
                })}
              </Badge>
            </span>
            <p className="max-w-[14rem] text-[11px] leading-snug text-slate-500 sm:text-right">
              {host.isLive
                ? "Aktualna baza — prawdziwy dokument ZD"
                : "Środowisko testowe Subiekta"}
            </p>
          </div>
        ) : hostPlaceholder ? (
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <span
              aria-hidden
              className="inline-block h-6 w-[5.5rem] rounded-md bg-slate-100 motion-safe:animate-pulse"
            />
            <span
              aria-hidden
              className="inline-block h-3 w-36 rounded bg-slate-100 motion-safe:animate-pulse"
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
