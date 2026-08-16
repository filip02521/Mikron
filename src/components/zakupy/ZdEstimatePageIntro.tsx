import type { ReactNode } from "react";
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
import {
  zdEstimateChromeControlHeightClass,
  zdEstimateHostBadgeClass,
  zdEstimatePageIntroClass,
  zdEstimatePageIntroRowClass,
  zdEstimateToolbarActionsClusterClass,
} from "@/lib/ui/ontime-theme";

/** @deprecated Alias — użyj ZdEstimateHostStrip. */
export type ZdEstimatePageIntroHost = ZdEstimateHostStrip;

/**
 * Top bar Kreatora ZD — tożsamość · fakty zakresu · akcje.
 * Lead / kroki tylko w HelpHint. Wszystkie elementy na wspólnej osi h-8.
 */
export function ZdEstimatePageIntro({
  title = "Kreator ZD",
  /** Ignorowane w UI — zostaje w API dla kompatybilności. */
  lead,
  /** Kontekst wejścia — tylko gdy brak `facts`. */
  contextLabel,
  /** Aktywny zakres — tylko gdy brak `facts`. */
  scopeLabel,
  /** Slot faktów (np. PrepScopeFacts toolbar) — wyłącza chipy context/scope. */
  facts,
  /** Slot akcji (Zmień zakres, menu Dostawcy/Reguły). */
  actions,
  hint,
  hintAriaLabel = "O kreatorze ZD",
  host = null,
  hostPlaceholder = false,
}: {
  title?: string;
  lead?: string;
  contextLabel?: string | null;
  scopeLabel?: string | null;
  facts?: ReactNode;
  actions?: ReactNode;
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

  const leadText = lead ?? zdEstimatePageLead();
  const flowSteps = zdEstimatePageFlowSteps();
  const flowHint = [
    "Kroki:",
    ...flowSteps.map(
      (step, index) => `${index + 1}. ${step.label} — ${step.hint}`
    ),
  ].join("\n");

  const combinedHint =
    [hint, leadText, flowHint, hostDetail].filter(Boolean).join("\n\n") ||
    undefined;

  const showHintSlot = Boolean(combinedHint) || hostPlaceholder;
  const scopeTrimmed = scopeLabel?.trim() || null;
  const useLegacyChips = facts == null;

  return (
    <header className={zdEstimatePageIntroClass}>
      <div className={zdEstimatePageIntroRowClass}>
        {/* Tożsamość */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            zdEstimateChromeControlHeightClass
          )}
        >
          <h1
            className={cn(
              "inline-flex items-center text-sm font-semibold leading-none tracking-tight text-slate-900",
              zdEstimateChromeControlHeightClass
            )}
          >
            {title}
          </h1>
          {showHintSlot ? (
            combinedHint ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center",
                  zdEstimateChromeControlHeightClass
                )}
              >
                <HelpHintBubble
                  message={combinedHint}
                  tone="slate"
                  size="sm"
                  ariaLabel={hintAriaLabel}
                />
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  "inline-flex items-center justify-center",
                  zdEstimateChromeControlHeightClass
                )}
              >
                <span className="inline-block size-4 rounded-full bg-slate-100 motion-safe:animate-pulse" />
              </span>
            )
          ) : null}
          {hostConfigured && host ? (
            <span
              title={hostDetail ?? undefined}
              className={cn(
                "inline-flex items-center",
                zdEstimateChromeControlHeightClass
              )}
            >
              <Badge
                variant={host.isLive ? "warning" : "success"}
                className={cn(
                  zdEstimateHostBadgeClass,
                  host.isLive
                    ? "ring-1 ring-amber-300/60"
                    : "ring-1 ring-emerald-300/50"
                )}
              >
                {zdEstimateHostBadgeLabel({
                  isLive: host.isLive,
                  port: host.port,
                })}
              </Badge>
            </span>
          ) : hostPlaceholder ? (
            <span
              aria-hidden
              className={cn(
                "inline-block w-[4.5rem] shrink-0 rounded-md bg-slate-100 motion-safe:animate-pulse",
                zdEstimateChromeControlHeightClass
              )}
            />
          ) : null}
        </div>

        {/* Fakty — ta sama oś pionowa */}
        {facts ? (
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center",
              zdEstimateChromeControlHeightClass
            )}
          >
            {facts}
          </div>
        ) : useLegacyChips && (contextLabel || scopeTrimmed) ? (
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5",
              zdEstimateChromeControlHeightClass
            )}
          >
            {contextLabel ? (
              <span
                title={contextLabel}
                className={cn(
                  "inline-flex max-w-[12rem] items-center truncate rounded-md bg-indigo-50/90 px-2 text-[11px] font-medium leading-none text-indigo-900/90 ring-1 ring-inset ring-indigo-100/90 sm:max-w-[16rem]",
                  zdEstimateChromeControlHeightClass
                )}
              >
                {contextLabel}
              </span>
            ) : null}
            {scopeTrimmed ? (
              <span
                title={scopeTrimmed}
                className={cn(
                  "inline-flex max-w-[10rem] items-center truncate rounded-md bg-emerald-50/90 px-2 text-[11px] font-medium leading-none text-emerald-900/90 ring-1 ring-inset ring-emerald-100/90 sm:max-w-[14rem]",
                  zdEstimateChromeControlHeightClass
                )}
              >
                {scopeTrimmed}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        {actions ? (
          <div className={zdEstimateToolbarActionsClusterClass}>{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
