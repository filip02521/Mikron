import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  deliveryUrgencyShowsBadge,
  type DeliveryUrgency,
} from "@/lib/orders/my-order-delivery-urgency";
import { salesTypography } from "@/lib/ui/ontime-theme";

const urgencyBadgeClass: Record<"overdue" | "today", string> = {
  overdue: "bg-amber-50 text-amber-900 ring-amber-200/90",
  today: "bg-indigo-50 text-indigo-900 ring-indigo-200/80",
};

export function DeliveryUrgencyBadge({
  urgency,
  label,
  className,
  title,
}: {
  urgency: DeliveryUrgency;
  label: string;
  className?: string;
  title?: string;
}) {
  if (!deliveryUrgencyShowsBadge(urgency) || !label.trim()) {
    return null;
  }

  const tone = urgency as keyof typeof urgencyBadgeClass;

  return (
    <span title={title} className="inline-flex max-w-full">
      <Badge
        variant="default"
        className={cn(
          "max-w-full whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-snug ring-1",
          salesTypography.rowMeta,
          urgencyBadgeClass[tone],
          className
        )}
      >
        {label}
      </Badge>
    </span>
  );
}
