import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { PlannedOrderDateDisplay } from "@/lib/orders/planned-order-date-label";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function PlannedOrderDateMeta({
  display,
  className,
  inline = false,
}: {
  display: PlannedOrderDateDisplay;
  className?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        inline ? "flex items-center gap-1" : "flex flex-col items-end gap-0.5 text-right",
        className
      )}
      title={display.title}
    >
      <span
        className={cn(
          panelTypography.caption,
          "font-medium uppercase tracking-wide text-slate-400"
        )}
      >
        {display.caption}
      </span>
      <Badge
        variant={display.badgeVariant}
        className="max-w-full whitespace-normal rounded-md px-2 py-0.5 text-[10px] font-semibold leading-snug tabular-nums"
      >
        {display.label}
      </Badge>
    </div>
  );
}
