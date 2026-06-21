import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { DeliveryUrgencyBadge } from "@/components/orders/DeliveryUrgencyBadge";
import { ZdFulfillmentDeadlineChangeNotice } from "@/components/orders/ZdFulfillmentDeadlineChangeNotice";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { buildDeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import { deliveryUrgencyBadgeLabel } from "@/lib/orders/my-order-delivery-urgency";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import type { MyOrderZdFulfillment, MyOrderZdFulfillmentSlot } from "@/lib/orders/my-order-sales-ui";
import {
  buildCollapsedZdMixedNoMatchHint,
  buildCollapsedZdMultiSlotHint,
  linesWithoutZdTerm,
  myOrderPositionCountLabel,
  resolveZdFulfillmentUrgency,
  zdFulfillmentCollapsedCaption,
  zdFulfillmentHasMultipleSlots,
  zdFulfillmentPrimarySlot,
  zdFulfillmentSlots,
  zdFulfillmentSlotsTooltip,
} from "@/lib/orders/my-order-zd-fulfillment-display";
import { salesTypography } from "@/lib/ui/ontime-theme";

function ZdSlotDateValue({ slot }: { slot: MyOrderZdFulfillmentSlot }) {
  const parsed = parseDateOnly(slot.deadline);
  if (!parsed) {
    return (
      <span className={cn("font-semibold tabular-nums text-slate-800", salesTypography.rowBody)}>
        {formatPlDate(slot.deadline)}
      </span>
    );
  }

  const display = buildDeliveryDateMetaDisplay(parsed);
  const countSuffix = slot.count > 1 ? ` · ${slot.count} prod.` : "";

  return (
    <div className="flex max-w-full flex-col items-end gap-0.5">
      <DeliveryDateMetaValue display={display} />
      {countSuffix ? (
        <span className={cn("font-medium text-slate-500", salesTypography.rowMeta)}>
          {countSuffix.replace(/^ · /, "")}
        </span>
      ) : null}
    </div>
  );
}

export function ZdFulfillmentDateMeta({
  fulfillment,
  className,
  collapsed = false,
  lines = [],
  onDismissDeadlineChange,
  dismissDeadlineChangePending = false,
  showDeadlineChangeDismiss = false,
}: {
  fulfillment: MyOrderZdFulfillment;
  className?: string;
  /** Zwinięta karta — jeden najwcześniejszy termin + podpowiedź o pozostałych. */
  collapsed?: boolean;
  lines?: Pick<
    MyOrderLine,
    | "product"
    | "zdFulfillment"
    | "zdEtaNoMatch"
    | "zdEtaPending"
    | "historyEstimateLabel"
  >[];
  onDismissDeadlineChange?: () => void;
  dismissDeadlineChangePending?: boolean;
  showDeadlineChangeDismiss?: boolean;
}) {
  const slots = zdFulfillmentSlots(fulfillment);
  const multiple = zdFulfillmentHasMultipleSlots(fulfillment);
  const showCollapsedSummary = collapsed && multiple;
  const visibleSlots = showCollapsedSummary ? [zdFulfillmentPrimarySlot(fulfillment)] : slots;
  const collapsedMultiSlotHint = showCollapsedSummary
    ? buildCollapsedZdMultiSlotHint(fulfillment, lines)
    : null;
  const collapsedMixedNoMatchHint = collapsed
    ? buildCollapsedZdMixedNoMatchHint(lines)
    : null;
  const collapsedHints = [collapsedMultiSlotHint, collapsedMixedNoMatchHint].filter(
    (hint): hint is string => Boolean(hint)
  );
  const syncedLabel = fulfillment.syncedAt
    ? formatPlDate(fulfillment.syncedAt.slice(0, 10))
    : null;
  const urgency = resolveZdFulfillmentUrgency(fulfillment);
  const badgeLabel = deliveryUrgencyBadgeLabel(urgency);
  const anyOverdue = slots.some((slot) => {
    const d = parseDateOnly(slot.deadline);
    return d != null && isPastExpectedDate(d);
  });
  const deadlineChange = fulfillment.deadlineChange ?? null;

  const withoutZdCount = linesWithoutZdTerm(lines).length;
  const tooltip = [
    zdFulfillmentSlotsTooltip(slots),
    withoutZdCount
      ? `${myOrderPositionCountLabel(withoutZdCount)} bez terminu w ZD — szczegóły po rozwinięciu`
      : null,
    syncedLabel ? `Ostatnia synchronizacja: ${syncedLabel}` : null,
    deadlineChange ? `${deadlineChange.title}: ${deadlineChange.detail}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const primaryDeadline = parseDateOnly(visibleSlots[0]!.deadline);
  const primaryDisplay = primaryDeadline
    ? buildDeliveryDateMetaDisplay(primaryDeadline)
    : null;

  return (
    <div className={cn("flex min-w-0 flex-col items-end gap-1", className)}>
      <DeliveryTimingMeta
        caption={zdFulfillmentCollapsedCaption(slots.length, { overdue: anyOverdue })}
        captionTone={anyOverdue ? "overdue" : "zd"}
        title={tooltip}
        accessory={
          badgeLabel ? (
            <DeliveryUrgencyBadge
              urgency={urgency.urgency}
              label={badgeLabel}
              title={urgency.detailLabel ?? undefined}
            />
          ) : null
        }
      >
        {showCollapsedSummary && primaryDisplay ? (
          <>
            <ZdSlotDateValue slot={visibleSlots[0]!} />
            <span className="max-w-full truncate text-[9px] font-medium text-slate-500">
              {visibleSlots[0]!.dokNr}
            </span>
          </>
        ) : multiple ? (
          <div className="flex max-w-full flex-col items-end gap-1.5">
            {visibleSlots.map((slot) => (
              <div
                key={`${slot.deadline}|${slot.dokNr}`}
                className="flex max-w-full flex-col items-end gap-0.5"
              >
                <ZdSlotDateValue slot={slot} />
                <span className="max-w-full truncate text-[9px] font-medium text-slate-500">
                  {slot.dokNr}
                </span>
              </div>
            ))}
          </div>
        ) : primaryDisplay ? (
          <>
            <DeliveryDateMetaValue display={primaryDisplay} />
            <span className="max-w-full truncate text-[9px] font-medium text-slate-500">
              {fulfillment.dokNr}
            </span>
          </>
        ) : null}
      </DeliveryTimingMeta>
      {collapsedHints.map((hint) => (
        <p
          key={hint}
          className={cn(
            "max-w-full text-right text-[10px] font-medium leading-snug text-indigo-900/85",
            salesTypography.rowMeta
          )}
        >
          {hint}
        </p>
      ))}
      {deadlineChange ? (
        <ZdFulfillmentDeadlineChangeNotice
          change={deadlineChange}
          compact
          onDismiss={showDeadlineChangeDismiss ? onDismissDeadlineChange : undefined}
          dismissPending={dismissDeadlineChangePending}
        />
      ) : null}
    </div>
  );
}
