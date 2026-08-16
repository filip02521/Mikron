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
 * Okno loadingu Kreatora ZD — brand + treść checklisty.
 * `stage` = pełna scena w workbenchu; `embedded` = karta w modalu (bez tła sceny).
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
  variant = "stage",
  showBrandHeader = true,
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
  variant?: "stage" | "embedded";
  showBrandHeader?: boolean;
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

  const windowEl = (
    <div
      id={focusId}
      tabIndex={focusId ? -1 : undefined}
      className={cn(
        zdEstimateLoadingWindowClass,
        focusId && "scroll-mt-6 outline-none",
        variant === "embedded" && "zd-est-loading-window--embedded max-w-none",
        windowClassName
      )}
    >
      {showBrandHeader ? (
        <header className={cn(zdEstimateLoadingWindowHeaderClass, "relative")}>
          <div
            className="zd-est-loading-window__accent pointer-events-none absolute inset-x-0 top-0 h-0.5"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="zd-est-loading-window__mark hidden size-1.5 shrink-0 rounded-full bg-indigo-500 sm:inline-block"
                aria-hidden
              />
              <h1 className="truncate text-sm font-medium tracking-tight text-slate-800 sm:text-[13px]">
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
      ) : null}
      {children}
    </div>
  );

  if (variant === "embedded") {
    return <div className={cn("w-full", className)}>{windowEl}</div>;
  }

  return (
    <div
      className={cn(zdEstimateLoadingStageClass, className)}
    >
      <div className="zd-est-loading-stage__glow" aria-hidden />
      {windowEl}
    </div>
  );
}
