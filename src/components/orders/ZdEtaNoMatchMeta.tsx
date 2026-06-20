import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import type { DeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";

const NO_MATCH_DISPLAY: DeliveryDateMetaDisplay = {
  primaryLabel: "Brak terminu",
  detailLabel: "w Subiekcie",
  overdue: false,
  title:
    "Sprawdziliśmy dokumenty ZD u dostawcy w Subiekcie — brak terminu realizacji dla tej pozycji.",
};

export function ZdEtaNoMatchMeta({ className }: { className?: string }) {
  return (
    <DeliveryTimingMeta
      className={className}
      caption={ZD_DELIVERY_META_CAPTION}
      captionTone="zd"
      title={NO_MATCH_DISPLAY.title}
    >
      <DeliveryDateMetaValue display={NO_MATCH_DISPLAY} />
    </DeliveryTimingMeta>
  );
}
