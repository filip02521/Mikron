import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import type { MyOrderZdFulfillment } from "@/lib/orders/my-order-sales-ui";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZdFulfillmentDateMeta({
  fulfillment,
  className,
}: {
  fulfillment: MyOrderZdFulfillment;
  className?: string;
}) {
  const deadlineDate = parseDateOnly(fulfillment.deadline);
  const dateLabel = formatPlDate(fulfillment.deadline);
  const overdue = deadlineDate != null && isPastExpectedDate(deadlineDate);
  const syncedLabel = fulfillment.syncedAt
    ? formatPlDate(fulfillment.syncedAt.slice(0, 10))
    : null;

  return (
    <div
      className={cn("flex min-w-0 flex-col items-end gap-0.5 text-right", className)}
      title={
        syncedLabel
          ? `Termin realizacji z dokumentu ${fulfillment.dokNr} u dostawcy. Ostatnia synchronizacja: ${syncedLabel}.`
          : `Termin realizacji z dokumentu ${fulfillment.dokNr} u dostawcy.`
      }
    >
      <span
        className={cn(
          salesTypography.rowMeta,
          "font-semibold uppercase tracking-wide",
          overdue ? "text-amber-800/85" : "text-indigo-600/80"
        )}
      >
        Termin z ZD
      </span>
      <Badge
        variant={overdue ? "warning" : "info"}
        className="max-w-full whitespace-normal rounded-md px-2 py-0.5 text-[10px] font-semibold leading-snug tabular-nums"
      >
        {dateLabel}
      </Badge>
      <span
        className={cn(
          salesTypography.rowMeta,
          "max-w-full truncate text-[9px] font-medium text-slate-500"
        )}
      >
        {fulfillment.dokNr}
      </span>
    </div>
  );
}
