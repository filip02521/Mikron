import { IconCalendar } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { ZD_FULFILLMENT_DEADLINE_CHANGE_CAPTION } from "@/lib/orders/zd-fulfillment-deadline-change";
import {
  mojeZdDeadlineChangeNoticeIconWrapClass,
  mojeZdDeadlineChangeNoticeShellClass,
} from "@/lib/ui/moje-shipment-row-styles";
import { brandLinkSubtleClass, deliveryMetaTypography } from "@/lib/ui/ontime-theme";

function ZdFulfillmentDeadlineChangeDateShift({
  change,
  compact,
  align,
}: {
  change: ZdFulfillmentDeadlineChangeDisplay;
  compact: boolean;
  align: "start" | "end";
}) {
  const postponed = change.variant === "postponed";
  const previousLabel = formatPlDate(change.previousDeadline);
  const currentLabel = formatPlDate(change.currentDeadline);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 tabular-nums",
        compact ? "text-[10px]" : "text-xs",
        align === "end" ? "justify-end" : "justify-start"
      )}
      aria-label={`Poprzedni termin ${previousLabel}, nowy termin ${currentLabel}`}
    >
      <span className="font-medium text-slate-500 line-through decoration-slate-400/90">
        {previousLabel}
      </span>
      <span className="font-medium text-slate-400" aria-hidden>
        →
      </span>
      <span
        className={cn(
          "font-semibold",
          postponed ? "text-amber-950" : "text-indigo-950"
        )}
      >
        {currentLabel}
      </span>
    </div>
  );
}

/** Kompaktowa informacja o zmianie terminu ZD — spójna z meta dostawy na /moje. */
export function ZdFulfillmentDeadlineChangeNotice({
  change,
  align = "end",
  compact = false,
  onDismiss,
  dismissPending = false,
  className,
}: {
  change: ZdFulfillmentDeadlineChangeDisplay;
  align?: "start" | "end";
  compact?: boolean;
  onDismiss?: () => void;
  dismissPending?: boolean;
  className?: string;
}) {
  const postponed = change.variant === "postponed";
  const captionClass = postponed
    ? deliveryMetaTypography.captionOverdue
    : deliveryMetaTypography.captionZd;
  const titleClass = postponed ? "text-amber-950" : "text-indigo-950";
  const iconSize = compact ? 13 : 15;
  const iconWrapSize = compact ? "h-6 w-6" : "h-7 w-7";

  return (
    <div
      className={cn(
        mojeZdDeadlineChangeNoticeShellClass(change.variant, compact),
        align === "end" ? "text-right" : "text-left",
        !compact && align === "start" && "w-full",
        className
      )}
      role="status"
      aria-live="polite"
      title={change.detail}
    >
      <div
        className={cn(
          "flex gap-2",
          align === "end" ? "flex-row-reverse" : "flex-row",
          onDismiss && !compact ? "items-start justify-between gap-3" : "items-start"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 gap-2",
            align === "end" ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span
            className={cn(
              mojeZdDeadlineChangeNoticeIconWrapClass(change.variant),
              iconWrapSize,
              "mt-0.5"
            )}
            aria-hidden
          >
            <IconCalendar size={iconSize} strokeWidth={2} />
          </span>

          <div className={cn("min-w-0 flex-1", align === "end" && "items-end")}>
            <p className={captionClass}>{ZD_FULFILLMENT_DEADLINE_CHANGE_CAPTION}</p>
            <p
              className={cn(
                "mt-0.5 font-semibold leading-snug",
                compact ? "text-[10px]" : "text-sm",
                titleClass
              )}
            >
              {change.title}
            </p>
            <div className={compact ? "mt-0.5" : "mt-1"}>
              <ZdFulfillmentDeadlineChangeDateShift
                change={change}
                compact={compact}
                align={align}
              />
            </div>
            {compact && onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={dismissPending}
                className={cn(
                  brandLinkSubtleClass,
                  "mt-1 text-[10px] font-medium disabled:opacity-50",
                  align === "end" ? "ml-auto block" : ""
                )}
              >
                Rozumiem
              </button>
            ) : null}
          </div>
        </div>

        {!compact && onDismiss ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDismiss}
            disabled={dismissPending}
            className={cn(
              "shrink-0",
              postponed
                ? "border-amber-200/90 text-amber-900 hover:bg-amber-50/80"
                : undefined
            )}
          >
            Rozumiem
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Jednowierszowy skrót zmiany terminu (mobile / subline). */
export function zdFulfillmentDeadlineChangeShortLabel(
  change: ZdFulfillmentDeadlineChangeDisplay
): string {
  const previousLabel = formatPlDate(change.previousDeadline);
  const currentLabel = formatPlDate(change.currentDeadline);
  return `${change.title} · ${previousLabel} → ${currentLabel}`;
}
