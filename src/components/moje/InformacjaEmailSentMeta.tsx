import { Badge } from "@/components/ui/Badge";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { cn } from "@/lib/cn";
import {
  buildInformacjaTimingMetaDisplay,
  shouldShowInformacjaTimingMeta,
} from "@/lib/orders/informacja-timing-meta";
import { deliveryMetaTypography } from "@/lib/ui/ontime-theme";

export { shouldShowInformacjaTimingMeta as shouldShowInformacjaEmailSentMeta };

export function InformacjaEmailSentMeta({
  timingLabel,
  className,
}: {
  timingLabel: string;
  className?: string;
}) {
  const display = buildInformacjaTimingMetaDisplay(timingLabel);
  if (!display) return null;

  const isAvailable = display.kind === "available";

  return (
    <DeliveryTimingMeta
      className={className}
      caption={display.caption}
      captionTone={isAvailable ? "available" : "default"}
      title={display.title}
    >
      <Badge
        variant="default"
        className={cn(
          isAvailable ? deliveryMetaTypography.dateBadgeAvailable : deliveryMetaTypography.dateBadge
        )}
      >
        {display.dateLabel}
      </Badge>
    </DeliveryTimingMeta>
  );
}
