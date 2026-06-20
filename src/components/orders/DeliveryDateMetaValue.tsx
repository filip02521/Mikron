import { cn } from "@/lib/cn";
import type { DeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Wartość daty w meta terminu — bez badge, spójna typografia. */
export function DeliveryDateMetaValue({
  display,
  className,
}: {
  display: DeliveryDateMetaDisplay;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-end gap-0.5", className)}>
      <span
        className={cn(
          "max-w-full whitespace-nowrap font-semibold tabular-nums leading-snug",
          salesTypography.rowBody,
          display.overdue ? "text-amber-950" : "text-slate-800"
        )}
      >
        {display.primaryLabel}
      </span>
      {display.detailLabel ? (
        <span
          className={cn(
            "max-w-full truncate font-medium tabular-nums text-slate-500",
            salesTypography.rowMeta
          )}
        >
          {display.detailLabel}
        </span>
      ) : null}
    </div>
  );
}
