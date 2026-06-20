import { Badge } from "@/components/ui/Badge";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";
import { deliveryMetaTypography } from "@/lib/ui/ontime-theme";

export function ZdEtaPendingMeta({ className }: { className?: string }) {
  return (
    <DeliveryTimingMeta
      className={className}
      caption={ZD_DELIVERY_META_CAPTION}
      captionTone="pending"
      title="Sprawdzamy termin realizacji w dokumentach ZD u dostawcy w Subiekcie."
    >
      <Badge variant="default" className={deliveryMetaTypography.statusBadgePending}>
        Sprawdzamy w Subiekcie…
      </Badge>
    </DeliveryTimingMeta>
  );
}
