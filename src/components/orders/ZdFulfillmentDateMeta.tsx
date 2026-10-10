import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { DeliveryUrgencyBadge } from "@/components/orders/DeliveryUrgencyBadge";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  buildPlaceholderZdDeliveryDateMetaDisplay,
  buildZdDeliveryDateMetaDisplay,
  ZD_FULFILLMENT_PLACEHOLDER_TITLE,
} from "@/lib/orders/zd-fulfillment-placeholder-deadline";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import {
  deliveryUrgencyBadgeLabel,
  shouldShowDeliveryUrgencyBadgeBesideDateMeta,
} from "@/lib/orders/my-order-delivery-urgency";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import type { MyOrderZdFulfillment, MyOrderZdFulfillmentSlot } from "@/lib/orders/my-order-sales-ui";
import {
  linesWithoutZdTerm,
  myOrderPositionCountLabel,
  resolveZdFulfillmentUrgency,
  zdFulfillmentCollapsedCaption,
  zdFulfillmentHasMultipleSlots,
  zdFulfillmentPrimarySlot,
  zdFulfillmentSlots,
  zdFulfillmentSlotsTooltip,
} from "@/lib/orders/my-order-zd-fulfillment-display";
import { ZD_DELIVERY_CERTAINTY_TAG } from "@/lib/orders/my-order-history-estimate-copy";
import { salesTypography } from "@/lib/ui/ontime-theme";

function ZdSlotDateValue({
  slot,
  pendingConfirmation = false,
  inline = false,
}: {
  slot: MyOrderZdFulfillmentSlot;
  pendingConfirmation?: boolean;
  inline?: boolean;
}) {
  if (pendingConfirmation) {
    return <DeliveryDateMetaValue display={buildPlaceholderZdDeliveryDateMetaDisplay()} inline={inline} />;
  }

  const parsed = parseDateOnly(slot.deadline);
  if (!parsed) {
    return (
      <span className={cn("font-semibold tabular-nums text-slate-800", salesTypography.rowBody)}>
        {formatPlDate(slot.deadline)}
      </span>
    );
  }

  const display = buildZdDeliveryDateMetaDisplay(parsed);
  const countSuffix = slot.count > 1 ? ` · ${slot.count} prod.` : "";

  return (
    <div className={cn(
      "max-w-full",
      inline ? "flex items-center gap-1" : "flex flex-col items-end gap-0.5"
    )}>
      <DeliveryDateMetaValue display={display} inline={inline} />
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
  inline = false,
  lines = [],
}: {
  fulfillment: MyOrderZdFulfillment;
  className?: string;
  /** Zwinięta karta — jeden najwcześniejszy termin + podpowiedź o pozostałych. */
  collapsed?: boolean;
  /** Poziomy układ w jednej linii (np. w rozwiniętej karcie). */
  inline?: boolean;
  lines?: Pick<
    MyOrderLine,
    | "product"
    | "zdFulfillment"
    | "zdEtaNoMatch"
    | "zdEtaPending"
    | "historyEstimateLabel"
  >[];
}) {
  const slots = zdFulfillmentSlots(fulfillment);
  const multiple = zdFulfillmentHasMultipleSlots(fulfillment);
  const visibleSlots = slots;
  const syncedLabel = fulfillment.syncedAt
    ? formatPlDate(fulfillment.syncedAt.slice(0, 10))
    : null;
  const pendingConfirmation = fulfillment.pendingConfirmation ?? false;
  const urgency = resolveZdFulfillmentUrgency(fulfillment);
  const badgeLabel = deliveryUrgencyBadgeLabel(urgency);
  const anyOverdue =
    !pendingConfirmation &&
    slots.some((slot) => {
      if (slot.pendingConfirmation) return false;
      const d = parseDateOnly(slot.deadline);
      return d != null && isPastExpectedDate(d);
    });
  const deadlineChange = fulfillment.deadlineChange ?? null;

  const withoutZdCount = linesWithoutZdTerm(lines).length;
  const tooltip = [
    pendingConfirmation ? ZD_FULFILLMENT_PLACEHOLDER_TITLE : null,
    zdFulfillmentSlotsTooltip(slots),
    withoutZdCount
      ? `${myOrderPositionCountLabel(withoutZdCount)} bez terminu w ZD - szczegóły po rozwinięciu`
      : null,
    syncedLabel ? `Ostatnia synchronizacja: ${syncedLabel}` : null,
    deadlineChange ? `${deadlineChange.title}: ${deadlineChange.detail}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (collapsed) {
    // Zwinięta karta: najpóźniejszy znany termin (kiedy klient dostanie całość), znacznik pewności
    // pod datą, numer ZD tylko w dymku, a pozycje bez terminu jako krótka plakietka.
    const datedSlots = slots.filter((slot) => !slot.pendingConfirmation && parseDateOnly(slot.deadline));
    const latestSlot =
      [...datedSlots].sort((a, b) => b.deadline.localeCompare(a.deadline))[0] ??
      zdFulfillmentPrimarySlot(fulfillment);
    const latestPending = pendingConfirmation || (latestSlot.pendingConfirmation ?? false);
    const latestDate = parseDateOnly(latestSlot.deadline);
    const latestDisplay = latestPending
      ? buildPlaceholderZdDeliveryDateMetaDisplay()
      : latestDate
        ? buildZdDeliveryDateMetaDisplay(latestDate)
        : null;
    const latestUrgent = shouldShowDeliveryUrgencyBadgeBesideDateMeta(latestDisplay, urgency);
    const caption = latestPending
      ? zdFulfillmentCollapsedCaption(1)
      : multiple || withoutZdCount > 0
        ? `${ZD_DELIVERY_CERTAINTY_TAG} · całość`
        : ZD_DELIVERY_CERTAINTY_TAG;
    return (
      <div className={cn(
        "min-w-0 max-w-full",
        inline ? "flex flex-wrap items-center gap-x-1.5 gap-y-0.5" : "flex flex-col items-end gap-1",
        className
      )}>
        <DeliveryTimingMeta
          caption={caption}
          captionTone={latestPending ? "pending" : anyOverdue ? "overdue" : "zd"}
          captionBelow
          title={tooltip}
          inline={inline}
          className="max-w-full"
          accessory={
            latestUrgent && badgeLabel ? (
              <DeliveryUrgencyBadge
                urgency={urgency.urgency}
                label={badgeLabel}
                title={urgency.detailLabel ?? undefined}
              />
            ) : null
          }
        >
          {latestDisplay ? (
            <DeliveryDateMetaValue display={latestDisplay} className="max-w-full" inline={inline} />
          ) : null}
        </DeliveryTimingMeta>
        {withoutZdCount > 0 ? (
          <span
            className="inline-flex max-w-full items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-900 ring-1 ring-inset ring-amber-200/80"
            title="Szczegóły i szacunek z historii po rozwinięciu"
          >
            {withoutZdCount} z {lines.length} bez terminu
          </span>
        ) : null}
      </div>
    );
  }

  const primarySlot = visibleSlots[0]!;
  const primaryPending = primarySlot.pendingConfirmation ?? pendingConfirmation;
  const primaryDeadline = parseDateOnly(primarySlot.deadline);
  const primaryDisplay = primaryPending
    ? buildPlaceholderZdDeliveryDateMetaDisplay()
    : primaryDeadline
      ? buildZdDeliveryDateMetaDisplay(primaryDeadline)
      : null;
  const showUrgencyBadge = shouldShowDeliveryUrgencyBadgeBesideDateMeta(primaryDisplay, urgency);

  return (
    <div className={cn(
      "min-w-0 max-w-full",
      inline ? "flex flex-wrap items-center gap-x-1.5 gap-y-0.5" : "flex flex-col items-end gap-1",
      className
    )}>
      <DeliveryTimingMeta
        caption={zdFulfillmentCollapsedCaption(slots.length, { overdue: anyOverdue })}
        captionTone={pendingConfirmation ? "pending" : anyOverdue ? "overdue" : "zd"}
        title={tooltip}
        inline={inline}
        className="max-w-full"
        accessory={
          showUrgencyBadge && badgeLabel ? (
            <DeliveryUrgencyBadge
              urgency={urgency.urgency}
              label={badgeLabel}
              title={urgency.detailLabel ?? undefined}
            />
          ) : null
        }
      >
        {multiple ? (
          <div className={cn(
            "max-w-full",
            inline ? "flex items-center gap-1.5" : "flex flex-col items-end gap-1.5"
          )}>
            {visibleSlots.map((slot) => (
              <div
                key={`${slot.deadline}|${slot.dokNr}`}
                className={cn(
                  "max-w-full",
                  inline ? "flex items-center gap-0.5" : "flex flex-col items-end gap-0.5"
                )}
              >
                <ZdSlotDateValue
                  slot={slot}
                  pendingConfirmation={slot.pendingConfirmation ?? pendingConfirmation}
                  inline={inline}
                />
                <span className="max-w-full truncate text-[11px] font-medium text-slate-500">
                  {slot.dokNr}
                </span>
              </div>
            ))}
          </div>
        ) : primaryDisplay ? (
          <>
            <DeliveryDateMetaValue display={primaryDisplay} className="max-w-full" inline={inline} />
            <span className="max-w-full truncate text-[11px] font-medium text-slate-500">
              {fulfillment.dokNr}
            </span>
          </>
        ) : null}
      </DeliveryTimingMeta>
    </div>
  );
}
