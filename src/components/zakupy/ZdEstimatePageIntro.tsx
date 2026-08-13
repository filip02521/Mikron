import { Badge } from "@/components/ui/Badge";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import {
  zdEstimateHostBadgeLabel,
  zdEstimateHostStripDetail,
} from "@/lib/orders/zd-estimate-ui-copy";

export type ZdEstimatePageIntroHost = {
  configured: boolean;
  isLive: boolean;
  port: number | null;
  salesEndFromFs: boolean;
  salesEndKeyFormatted: string | null;
};

/**
 * Nagłówek strony szacunku — tytuł, krótki flow i status hosta w jednej kompozycji
 * (bez drugiej belki „alertowej” pod PageHeader).
 */
export function ZdEstimatePageIntro({
  title = "Kreator ZD",
  description,
  hint,
  hintAriaLabel = "O kreatorze ZD",
  host = null,
  /** Rezerwuje miejsce na badge + strip podczas route loading (bez skoku layoutu). */
  hostPlaceholder = false,
}: {
  title?: string;
  description: string;
  hint?: string;
  hintAriaLabel?: string;
  host?: ZdEstimatePageIntroHost | null;
  hostPlaceholder?: boolean;
}) {
  const hostConfigured = host?.configured === true;
  const hostDetail =
    hostConfigured && host
      ? zdEstimateHostStripDetail({
          isLive: host.isLive,
          salesEndFromFs: host.salesEndFromFs,
          salesEndKeyFormatted: host.salesEndKeyFormatted,
        })
      : null;

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem] sm:leading-tight">
              {title}
            </h1>
            {hint ? (
              <HelpHintBubble
                message={hint}
                tone="slate"
                size="md"
                ariaLabel={hintAriaLabel}
              />
            ) : null}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        {hostConfigured && host ? (
          <Badge
            variant={host.isLive ? "warning" : "success"}
            className="mt-1 shrink-0 self-start tabular-nums tracking-wide"
          >
            {zdEstimateHostBadgeLabel({
              isLive: host.isLive,
              port: host.port,
            })}
          </Badge>
        ) : hostPlaceholder ? (
          <span
            aria-hidden
            className="mt-1 inline-block h-6 w-[5.5rem] shrink-0 self-start rounded-md bg-slate-100 motion-safe:animate-pulse"
          />
        ) : null}
      </div>

      {hostDetail ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs leading-snug",
            host?.isLive
              ? "border-slate-200/90 bg-slate-50/80 text-slate-600"
              : "border-emerald-200/70 bg-emerald-50/40 text-emerald-900/80"
          )}
          role="status"
        >
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              host?.isLive ? "bg-amber-500" : "bg-emerald-500"
            )}
            aria-hidden
          />
          <span className="min-w-0">{hostDetail}</span>
        </div>
      ) : hostPlaceholder ? (
        <div
          aria-hidden
          className="h-9 rounded-lg border border-slate-100 bg-slate-50/80 motion-safe:animate-pulse"
        />
      ) : null}
    </header>
  );
}
