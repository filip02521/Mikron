import { Badge } from "@/components/ui/Badge";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  zdEstimateHostBadgeLabel,
  zdEstimateHostStripDetail,
} from "@/lib/orders/zd-estimate-ui-copy";

/** @deprecated Alias — użyj ZdEstimateHostStrip. */
export type ZdEstimatePageIntroHost = ZdEstimateHostStrip;

/**
 * Slim nagłówek Kreatora ZD — tytuł + jeden akapit flow + badge hosta.
 * Host detail tylko w HelpHint (bez drugiej linii pod badge → bez skoku layoutu).
 */
export function ZdEstimatePageIntro({
  title = "Kreator ZD",
  description,
  hint,
  hintAriaLabel = "O kreatorze ZD",
  host = null,
  /** Rezerwuje miejsce na hint + badge (np. skeleton), bez skoku layoutu. */
  hostPlaceholder = false,
}: {
  title?: string;
  description: string;
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

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="min-w-0 max-w-3xl space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem] sm:leading-tight">
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
          <p className="text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        {hostConfigured && host ? (
          <span
            className="mt-0.5 shrink-0 self-start"
            title={hostDetail ?? undefined}
          >
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
            className="mt-0.5 inline-block h-6 w-[5.5rem] shrink-0 self-start rounded-md bg-slate-100 motion-safe:animate-pulse"
          />
        ) : null}
      </div>
    </header>
  );
}
