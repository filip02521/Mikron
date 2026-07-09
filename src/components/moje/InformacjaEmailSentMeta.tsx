import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { cn } from "@/lib/cn";
import {
  buildInformacjaTimingMetaDisplay,
  shouldShowInformacjaTimingMeta,
} from "@/lib/orders/informacja-timing-meta";
import { salesTypography } from "@/lib/ui/ontime-theme";

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
      <span
        className={cn(
          "max-w-full truncate font-semibold leading-snug tabular-nums",
          salesTypography.rowBody,
          isAvailable ? "text-sky-800" : "text-slate-700"
        )}
      >
        {display.dateLabel}
      </span>
    </DeliveryTimingMeta>
  );
}
