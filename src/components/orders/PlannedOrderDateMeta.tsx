import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { cn } from "@/lib/cn";
import type { PlannedOrderDateDisplay } from "@/lib/orders/planned-order-date-label";
import { deliveryMetaTypography, panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

export function PlannedOrderDateMeta({
  display,
  className,
  inline = false,
  /** panel = jedna linia w nagłówku karty Dziś (mniej wysokości). */
  density = "default",
}: {
  display: PlannedOrderDateDisplay;
  className?: string;
  inline?: boolean;
  density?: "default" | "panel";
}) {
  if (density === "panel") {
    return (
      <div
        className={cn("shrink-0 text-right leading-none", className)}
        title={display.title ?? `${display.caption} ${display.label}`}
      >
        <span className={cn(deliveryMetaTypography.caption, "whitespace-nowrap")}>
          {display.caption}
        </span>
        <span
          className={cn(
            panelTypography.caption,
            "ml-1.5 whitespace-nowrap font-semibold tabular-nums text-slate-700"
          )}
        >
          {display.label}
        </span>
      </div>
    );
  }

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
          "whitespace-nowrap font-semibold leading-snug tabular-nums",
          salesTypography.rowBody,
          "text-slate-700"
        )}
      >
        {display.label}
      </span>
    </DeliveryTimingMeta>
  );
}
