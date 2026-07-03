import { cn } from "@/lib/cn";
import type { DeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Wartość daty w meta terminu — bez badge, spójna typografia. */
export function DeliveryDateMetaValue({
  display,
  className,
  inline = false,
}: {
  display: DeliveryDateMetaDisplay;
  className?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full",
        inline ? "flex items-center gap-1" : "flex flex-col items-end gap-0.5",
        className
      )}
      title={display.title}
    >
      <span
        className={cn(
          "max-w-full truncate font-semibold leading-snug",
          salesTypography.rowBody,
          display.overdue ? "text-amber-950" : "text-slate-800",
          /^\d/.test(display.primaryLabel) ? "tabular-nums" : null
        )}
      >
        {display.primaryLabel}
      </span>
      {display.detailLabel ? (
        <span
          className={cn(
            "max-w-full truncate font-medium text-slate-500 sm:max-w-[14rem]",
            salesTypography.rowMeta
          )}
        >
          {display.detailLabel}
        </span>
      ) : null}
    </div>
  );
}
