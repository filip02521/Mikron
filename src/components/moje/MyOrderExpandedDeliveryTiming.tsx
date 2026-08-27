import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { DeliveryUrgencyBadge } from "@/components/orders/DeliveryUrgencyBadge";
import { cn } from "@/lib/cn";
import type { MyOrderDeliveryTimingDisplay } from "@/lib/orders/my-order-delivery-timing-display";
import { deliveryUrgencyShowsBadge } from "@/lib/orders/my-order-delivery-urgency";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Rozdziela datę i numer ZD z linii szacunku (np. „01.09.2026 · ZD 157/M/08/2026”). */
export function splitExpandedDeliveryEstimate(
  estimate: string,
  zdDocNumber?: string | null
): { datePart: string; docPart: string | null } {
  const trimmed = estimate.trim();
  if (!trimmed) return { datePart: "", docPart: null };

  const knownDoc = zdDocNumber?.trim() || null;
  if (knownDoc && trimmed.includes(knownDoc)) {
    const datePart = trimmed
      .replace(knownDoc, "")
      .replace(/\s*·\s*·\s*/g, " · ")
      .replace(/^\s*·\s*|\s*·\s*$/g, "")
      .trim();
    return { datePart: datePart || trimmed, docPart: knownDoc };
  }

  const matched = trimmed.match(/^(.*?)\s*·\s*(ZD\b.+)$/i);
  if (matched?.[1]?.trim() && matched[2]?.trim()) {
    return { datePart: matched[1].trim(), docPart: matched[2].trim() };
  }

  return { datePart: trimmed, docPart: null };
}

const panelShellClass =
  "rounded-md border px-2.5 py-1.5";

/**
 * Kompaktowy pasek terminu nad produktami:
 * lewa — podpis + data; prawa — ZD + pilność.
 */
export function MyOrderExpandedDeliveryTiming({
  display,
  searchQuery,
  className,
}: {
  display: MyOrderDeliveryTimingDisplay;
  searchQuery?: string | null;
  className?: string;
}) {
  const isOverdue = display.tone === "overdue";
  const isZd = display.tone === "zd-sourced" || Boolean(display.zdDocNumber);
  const showBadge =
    display.urgency &&
    display.urgencyLabel &&
    deliveryUrgencyShowsBadge(display.urgency);

  const { datePart, docPart } = splitExpandedDeliveryEstimate(
    display.estimate,
    display.zdDocNumber
  );

  const title = display.title.replace(/:\s*$/, "");
  const hasTrailing = Boolean(docPart) || showBadge;

  return (
    <section
      className={cn(
        panelShellClass,
        isOverdue
          ? "border-amber-200/70 bg-amber-50/45"
          : isZd
            ? "border-indigo-200/55 bg-indigo-50/30"
            : "border-slate-200/70 bg-slate-50/45",
        className
      )}
      aria-label={title}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          hasTrailing ? "justify-between" : null
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span
              className={cn(
                "shrink-0 text-[10px] font-medium leading-none",
                isOverdue
                  ? "text-amber-800/75"
                  : isZd
                    ? "text-indigo-600/70"
                    : "text-slate-400"
              )}
            >
              {title}
            </span>
            <SearchHighlightText
              text={datePart}
              searchQuery={searchQuery}
              className={cn(
                "min-w-0 font-semibold tabular-nums leading-none",
                salesTypography.rowBody,
                isOverdue ? "text-amber-950" : "text-slate-900"
              )}
            />
          </div>
          {display.detail ? (
            <p
              className={cn(
                "mt-0.5 min-w-0 leading-snug text-slate-500",
                salesTypography.rowMeta
              )}
            >
              {display.detail}
            </p>
          ) : null}
        </div>

        {hasTrailing ? (
          <div className="flex shrink-0 items-center gap-1.5 self-center">
            {docPart ? (
              <span
                className={cn(
                  "max-w-[11rem] truncate rounded px-1.5 py-0.5 font-medium tabular-nums leading-none ring-1 ring-inset",
                  salesTypography.rowMeta,
                  isOverdue
                    ? "bg-amber-100/70 text-amber-950 ring-amber-200/70"
                    : "bg-white/90 text-slate-600 ring-slate-200/80"
                )}
                title={docPart}
              >
                <SearchHighlightText text={docPart} searchQuery={searchQuery} />
              </span>
            ) : null}
            {showBadge && display.urgency && display.urgencyLabel ? (
              <DeliveryUrgencyBadge
                urgency={display.urgency}
                label={display.urgencyLabel}
                title={display.detail ?? undefined}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
