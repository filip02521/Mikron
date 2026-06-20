import { cn } from "@/lib/cn";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { brandLinkSubtleClass, salesTypography } from "@/lib/ui/ontime-theme";

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

  return (
    <div
      className={cn(
        "rounded-md border",
        compact ? "px-2 py-1" : "px-2.5 py-1.5",
        postponed
          ? "border-amber-200/90 bg-amber-50/80"
          : "border-indigo-200/85 bg-indigo-50/75",
        align === "end" ? "text-right" : "text-left",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <p
        className={cn(
          "font-semibold leading-snug",
          compact ? "text-[10px]" : "text-[11px]",
          postponed ? "text-amber-950" : "text-indigo-950"
        )}
      >
        {change.title}
      </p>
      <p
        className={cn(
          "mt-0.5 font-medium tabular-nums leading-snug text-slate-600",
          compact ? salesTypography.rowMeta : "text-[11px]"
        )}
      >
        {change.detail}
      </p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissPending}
          className={cn(
            brandLinkSubtleClass,
            "mt-1 text-[11px] font-medium disabled:opacity-50",
            align === "end" ? "ml-auto block" : ""
          )}
        >
          Rozumiem
        </button>
      ) : null}
    </div>
  );
}

/** Jednowierszowy skrót zmiany terminu (mobile / subline). */
export function zdFulfillmentDeadlineChangeShortLabel(
  change: ZdFulfillmentDeadlineChangeDisplay
): string {
  return `${change.title} · ${change.detail}`;
}
