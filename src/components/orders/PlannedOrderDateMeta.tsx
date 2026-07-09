import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { cn } from "@/lib/cn";
import type { PlannedOrderDateDisplay } from "@/lib/orders/planned-order-date-label";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function PlannedOrderDateMeta({
  display,
  className,
  inline = false,
}: {
  display: PlannedOrderDateDisplay;
  className?: string;
  inline?: boolean;
}) {
  return (
    <DeliveryTimingMeta
      className={className}
      caption={display.caption}
      captionTone="default"
      title={display.title}
      inline={inline}
    >
      <span
        className={cn(
          "max-w-full truncate font-semibold leading-snug tabular-nums",
          salesTypography.rowBody,
          "text-slate-700"
        )}
      >
        {display.label}
      </span>
    </DeliveryTimingMeta>
  );
}
