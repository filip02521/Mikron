import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { cn } from "@/lib/cn";
import type { MyOrderDeliveryTimingDisplay } from "@/lib/orders/my-order-delivery-timing-display";
import { mojeShipmentExpandedMetaShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { salesTypography } from "@/lib/ui/ontime-theme";

const toneShellClass = {
  default: "border-indigo-100/80 bg-indigo-50/40",
  overdue: "border-amber-200/80 bg-amber-50/60",
  "low-confidence": "",
} as const;

const toneTitleClass = {
  default: "text-slate-400",
  overdue: "text-amber-800/80",
  "low-confidence": "text-slate-400",
} as const;

const toneEstimateClass = {
  default: "text-slate-700",
  overdue: "font-semibold text-amber-900",
  "low-confidence": "text-slate-700",
} as const;

export function MyOrderExpandedDeliveryTiming({
  display,
  searchQuery,
  className,
}: {
  display: MyOrderDeliveryTimingDisplay;
  searchQuery?: string | null;
  className?: string;
}) {
  return (
    <section
      className={cn(
        mojeShipmentExpandedMetaShellClass,
        toneShellClass[display.tone],
        className
      )}
      aria-label={display.title}
    >
      <dl className="min-w-0">
        <dt
          className={cn(
            "font-semibold uppercase tracking-wide",
            salesTypography.rowMeta,
            toneTitleClass[display.tone]
          )}
        >
          {display.title}
        </dt>
        <SearchHighlightText
          text={display.estimate}
          searchQuery={searchQuery}
          as="dd"
          className={cn(
            "mt-0.5 min-w-0 font-medium tabular-nums leading-snug",
            salesTypography.rowBody,
            toneEstimateClass[display.tone]
          )}
        />
        {display.detail ? (
          <dd
            className={cn(
              "mt-1 min-w-0 leading-snug text-slate-500",
              salesTypography.rowMeta,
              display.tone === "overdue" && "text-amber-900/80"
            )}
          >
            {display.detail}
          </dd>
        ) : null}
      </dl>
    </section>
  );
}
