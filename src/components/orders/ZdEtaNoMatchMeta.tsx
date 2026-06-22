import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import type { DeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import {
  ZD_ETA_NO_MATCH_DETAIL_LABEL,
  ZD_ETA_NO_MATCH_PRIMARY_LABEL,
  ZD_ETA_NO_MATCH_TITLE,
} from "@/lib/orders/my-order-zd-eta-copy";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";

const NO_MATCH_DISPLAY: DeliveryDateMetaDisplay = {
  primaryLabel: ZD_ETA_NO_MATCH_PRIMARY_LABEL,
  detailLabel: ZD_ETA_NO_MATCH_DETAIL_LABEL,
  overdue: false,
  title: ZD_ETA_NO_MATCH_TITLE,
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
