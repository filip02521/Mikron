import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { DeliveryUrgencyBadge } from "@/components/orders/DeliveryUrgencyBadge";
import { cn } from "@/lib/cn";
import type { MyOrderDeliveryTimingDisplay } from "@/lib/orders/my-order-delivery-timing-display";
import { deliveryUrgencyShowsBadge } from "@/lib/orders/my-order-delivery-urgency";
import { mojeShipmentExpandedMetaShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { deliveryMetaTypography, panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

export function MyOrderExpandedDeliveryTiming({
  display,
  searchQuery,
  className,
}: {
  display: MyOrderDeliveryTimingDisplay;
  searchQuery?: string | null;
  className?: string;
}) {
  const isOverdue = display.tone === "overdue";
  const showBadge =
    display.urgency &&
    display.urgencyLabel &&
    deliveryUrgencyShowsBadge(display.urgency);

  return (
    <section
      className={cn(
        mojeShipmentExpandedMetaShellClass,
        isOverdue && "border-amber-200/80 bg-amber-50/50",
        className
      )}
      aria-label={display.title}
    >
      <dl className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <dt
            className={cn(
              panelTypography.caption,
              "font-medium uppercase tracking-wide",
              isOverdue ? deliveryMetaTypography.captionOverdue : "text-slate-400"
            )}
          >
            {display.title}
          </dt>
          {showBadge && display.urgency && display.urgencyLabel ? (
            <DeliveryUrgencyBadge
              urgency={display.urgency}
              label={display.urgencyLabel}
              title={display.detail ?? undefined}
            />
          ) : null}
        </div>
        <SearchHighlightText
          text={display.estimate}
          searchQuery={searchQuery}
          as="dd"
          className={cn(
            "mt-0.5 min-w-0 font-medium tabular-nums leading-snug",
            salesTypography.rowBody,
            isOverdue ? "font-semibold text-amber-950" : "text-slate-800"
          )}
        />
        {display.detail ? (
          <dd className={cn("mt-1 min-w-0 leading-snug text-slate-500", salesTypography.rowMeta)}>
            {display.detail}
          </dd>
        ) : null}
      </dl>
    </section>
  );
}
