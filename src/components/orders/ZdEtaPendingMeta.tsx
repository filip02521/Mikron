import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import {
  ZD_ETA_PENDING_BADGE_LABEL,
  ZD_ETA_PENDING_COMPACT_BADGE,
  ZD_ETA_PENDING_TITLE,
} from "@/lib/orders/my-order-zd-eta-copy";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";
import { salesTypography } from "@/lib/ui/ontime-theme";
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
        <span
          className={cn(
            "max-w-full truncate font-medium leading-snug",
            salesTypography.rowMeta,
            "text-slate-500"
          )}
        >
          {ZD_ETA_PENDING_COMPACT_BADGE}
        </span>
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
      <span
        className={cn(
          "max-w-full truncate font-medium leading-snug",
          salesTypography.rowMeta,
          "text-slate-500"
        )}
      >
        {ZD_ETA_PENDING_BADGE_LABEL}
      </span>
    </DeliveryTimingMeta>
  );
}
