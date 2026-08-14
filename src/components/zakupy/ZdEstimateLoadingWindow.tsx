import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  zdEstimateHostBadgeLabel,
  zdEstimateHostStripDetail,
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
} from "@/lib/orders/zd-estimate-ui-copy";
import {
  zdEstimateLoadingStageClass,
  zdEstimateLoadingWindowClass,
  zdEstimateLoadingWindowHeaderClass,
} from "@/lib/ui/ontime-theme";

/** @deprecated Alias — użyj ZdEstimateHostStrip. */
export type ZdEstimateLoadingWindowHost = ZdEstimateHostStrip;

/**
 * Wyśrodkowane okno loadingu Kreatora ZD — kompaktowy brand + treść checklisty.
 */
export function ZdEstimateLoadingWindow({
  title = "Kreator ZD",
  description = ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  hint,
  hintAriaLabel = "O kreatorze ZD",
  host = null,
  hostPlaceholder = false,
  children,
  className,
  windowClassName,
  focusId,
}: {
  title?: string;
  description?: string;
  hint?: string;
  hintAriaLabel?: string;
  host?: ZdEstimateHostStrip | null;
  hostPlaceholder?: boolean;
  children: ReactNode;
  className?: string;
  windowClassName?: string;
  /** Id pod scroll/focus (np. launch progress). */
  focusId?: string;
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

  return (
    <div className={cn(zdEstimateLoadingStageClass, className)}>
      <div
        id={focusId}
        tabIndex={focusId ? -1 : undefined}
        className={cn(
          zdEstimateLoadingWindowClass,
          focusId && "scroll-mt-6 outline-none",
          windowClassName
        )}
      >
        <header className={zdEstimateLoadingWindowHeaderClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <h1 className="truncate text-[1.0625rem] font-semibold tracking-tight text-slate-900 sm:text-lg">
                {title}
              </h1>
              {showHintSlot ? (
                combinedHint ? (
                  <HelpHintBubble
                    message={combinedHint}
                    tone="slate"
                    size="sm"
                    ariaLabel={hintAriaLabel}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="inline-block size-4 shrink-0 rounded-full bg-slate-100 motion-safe:animate-pulse"
                  />
                )
              ) : null}
            </div>
            {hostConfigured && host ? (
              <span className="shrink-0" title={hostDetail ?? undefined}>
                <Badge
                  variant={host.isLive ? "warning" : "success"}
                  className="tabular-nums tracking-wide"
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
                className="inline-block h-5 w-[4.75rem] shrink-0 rounded-md bg-slate-100 motion-safe:animate-pulse"
              />
            ) : null}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
            {description}
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
