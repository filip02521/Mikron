import { Badge } from "@/components/ui/Badge";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import {
  ZD_ETA_PENDING_BADGE_LABEL,
  ZD_ETA_PENDING_COMPACT_BADGE,
  ZD_ETA_PENDING_TITLE,
} from "@/lib/orders/my-order-zd-eta-copy";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";
import { deliveryMetaTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function ZdEtaPendingMeta({
  className,
  compact = false,
}: {
  className?: string;
  /** Obok szacunku z historii lub terminu ZD innej pozycji w grupie. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn("inline-flex max-w-full", className)} title={ZD_ETA_PENDING_TITLE}>
        <Badge
          variant="default"
          className={deliveryMetaTypography.statusBadgePending}
        >
          {ZD_ETA_PENDING_COMPACT_BADGE}
        </Badge>
      </span>
    );
  }

  return (
    <DeliveryTimingMeta
      className={className}
      caption={ZD_DELIVERY_META_CAPTION}
      captionTone="pending"
      title={ZD_ETA_PENDING_TITLE}
    >
      <Badge variant="default" className={deliveryMetaTypography.statusBadgePending}>
        {ZD_ETA_PENDING_BADGE_LABEL}
      </Badge>
    </DeliveryTimingMeta>
  );
}
