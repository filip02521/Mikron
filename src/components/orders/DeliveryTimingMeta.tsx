import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { deliveryMetaTypography } from "@/lib/ui/ontime-theme";

export type DeliveryTimingMetaCaptionTone =
  | "default"
  | "zd"
  | "available"
  | "overdue"
  | "pending";

const captionToneClass: Record<DeliveryTimingMetaCaptionTone, string> = {
  default: deliveryMetaTypography.caption,
  zd: deliveryMetaTypography.captionZd,
  available: deliveryMetaTypography.captionAvailable,
  overdue: deliveryMetaTypography.captionOverdue,
  pending: deliveryMetaTypography.captionPending,
};

/** Wspólny układ meta terminu na zwiniętej karcie /moje. */
export function DeliveryTimingMeta({
  caption,
  captionTone = "default",
  accessory,
  children,
  className,
  title,
  inline = false,
}: {
  caption: string;
  captionTone?: DeliveryTimingMetaCaptionTone;
  accessory?: React.ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        inline
          ? "flex items-center gap-1.5"
          : "flex flex-col items-end gap-0.5 text-right",
        className
      )}
      title={title}
    >
      <div className={cn("flex items-center gap-1", inline ? "" : "flex-wrap justify-end")}>
        <span className={captionToneClass[captionTone]}>{caption}</span>
        {accessory}
      </div>
      {children}
    </div>
  );
}
