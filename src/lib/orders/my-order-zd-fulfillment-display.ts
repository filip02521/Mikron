import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import {
  classifyDeliveryUrgency,
  type DeliveryUrgency,
  type MyOrderDeliveryUrgency,
} from "@/lib/orders/my-order-delivery-urgency";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import type { MyOrderZdFulfillment, MyOrderZdFulfillmentSlot } from "@/lib/orders/my-order-sales-ui";
import { todayInWarsaw } from "@/lib/time/warsaw";

const URGENCY_RANK: Record<DeliveryUrgency, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  this_week: 3,
  later: 4,
  unknown: 5,
  pending: 6,
};

export const ZD_DELIVERY_META_CAPTION = "Planowana dostawa";

export function zdFulfillmentSlots(
  fulfillment: Pick<MyOrderZdFulfillment, "deadline" | "dokNr" | "slots">
): MyOrderZdFulfillmentSlot[] {
  if (fulfillment.slots?.length) return fulfillment.slots;
  return [{ deadline: fulfillment.deadline, dokNr: fulfillment.dokNr, count: 1 }];
}

export function zdFulfillmentHasMultipleSlots(fulfillment: MyOrderZdFulfillment): boolean {
  return (fulfillment.slots?.length ?? 0) > 1;
}

export function zdFulfillmentSlotKey(
  slot: Pick<MyOrderZdFulfillmentSlot, "deadline" | "dokNr">
): string {
  return `${slot.deadline}|${slot.dokNr}`;
}

export function zdFulfillmentPrimarySlot(
  fulfillment: Pick<MyOrderZdFulfillment, "deadline" | "dokNr" | "slots">
): MyOrderZdFulfillmentSlot {
  return zdFulfillmentSlots(fulfillment)[0]!;
}

export function lineMatchesZdSlot(
  line: Pick<MyOrderLine, "zdFulfillment">,
  slot: Pick<MyOrderZdFulfillmentSlot, "deadline" | "dokNr">
): boolean {
  const zd = line.zdFulfillment;
  if (!zd) return false;
  return zdFulfillmentSlotKey(zd) === zdFulfillmentSlotKey(slot);
}

export function productNamesForZdSlot(
  lines: Pick<MyOrderLine, "product" | "zdFulfillment">[],
  slot: Pick<MyOrderZdFulfillmentSlot, "deadline" | "dokNr">
): string[] {
  const names: string[] = [];
  for (const line of lines) {
    if (!lineMatchesZdSlot(line, slot)) continue;
    const name = line.product?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Skrócona lista nazw produktów (np. „A i B”, „A, B i +2”). */
export function formatZdProductNameList(names: string[], maxShown = 2): string {
  if (!names.length) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  const head = names.slice(0, maxShown).join(", ");
  const rest = names.length - maxShown;
  return rest > 0 ? `${head} i +${rest}` : head;
}

/** Podpis pod terminem ZD na zwiniętej karcie z wieloma terminami. */
export function buildCollapsedZdMultiSlotHint(
  fulfillment: MyOrderZdFulfillment,
  lines: Pick<MyOrderLine, "product" | "zdFulfillment">[]
): string | null {
  if (!zdFulfillmentHasMultipleSlots(fulfillment)) return null;

  const slots = zdFulfillmentSlots(fulfillment);
  const primary = zdFulfillmentPrimarySlot(fulfillment);
  const primaryNames = formatZdProductNameList(productNamesForZdSlot(lines, primary));
  const extraSlots = slots.length - 1;
  const extraLabel =
    extraSlots === 1 ? "1 późniejszy termin" : `${extraSlots} późniejsze terminy`;

  if (primaryNames) {
    return `Najszybsza dostawa: ${primaryNames} — rozwiń po ${extraLabel}`;
  }
  return `${slots.length} terminy u dostawcy — rozwiń po szczegóły`;
}

type LineZdTermState = Pick<
  MyOrderLine,
  "zdFulfillment" | "zdEtaNoMatch" | "zdEtaPending" | "historyEstimateLabel"
>;

function polishPositionCount(n: number): string {
  if (n === 1) return "1 pozycja";
  if (n >= 2 && n <= 4) return `${n} pozycje`;
  return `${n} pozycji`;
}

export { polishPositionCount as myOrderPositionCountLabel };

/** Pozycje grupy bez dopasowanego terminu ZD (sync lub oczekiwanie). */
export function linesWithoutZdTerm(lines: LineZdTermState[]): LineZdTermState[] {
  return lines.filter(
    (line) => !line.zdFulfillment && (line.zdEtaNoMatch || line.zdEtaPending)
  );
}

/** Podpis na zwiniętej karcie — część pozycji bez terminu ZD, szacunek z historii po rozwinięciu. */
export function buildCollapsedZdMixedNoMatchHint(lines: LineZdTermState[]): string | null {
  const withoutZd = linesWithoutZdTerm(lines);
  if (!withoutZd.length) return null;

  const pendingOnly = withoutZd.filter((line) => line.zdEtaPending);
  const withHistory = withoutZd.filter((line) => line.historyEstimateLabel?.trim());
  const countLabel = polishPositionCount(withoutZd.length);

  if (pendingOnly.length === withoutZd.length) {
    return `${countLabel} czeka na termin w ZD — rozwiń po szczegóły`;
  }
  if (withHistory.length) {
    return `${countLabel} bez terminu w ZD — rozwiń po szacunek z historii`;
  }
  return `${countLabel} bez terminu w ZD — rozwiń po szczegóły`;
}

/** Zwinięty wiersz / subline — tylko najwcześniejszy termin ZD. */
export function salesZdPrimarySlotTimingLabel(
  fulfillment: Pick<MyOrderZdFulfillment, "deadline" | "dokNr" | "slots">,
  overdue: boolean
): string {
  const primary = zdFulfillmentPrimarySlot(fulfillment);
  const overdueSuffix = overdue ? " · po terminie" : "";
  return `do ${formatPlDate(primary.deadline)} · ${primary.dokNr}${overdueSuffix}`;
}

export function zdFulfillmentCollapsedCaption(
  slotCount: number,
  options?: { overdue?: boolean }
): string {
  const base = options?.overdue ? "Termin u dostawcy" : ZD_DELIVERY_META_CAPTION;
  if (slotCount <= 1) return base;
  const n = slotCount;
  const word = n === 2 ? "terminy" : n < 5 ? "terminy" : "terminów";
  return `${base} · ${n} ${word}`;
}

export function resolveZdFulfillmentUrgency(
  fulfillment: MyOrderZdFulfillment,
  at: Date = todayInWarsaw()
): MyOrderDeliveryUrgency {
  const slots = zdFulfillmentSlots(fulfillment);
  let worst: MyOrderDeliveryUrgency = classifyDeliveryUrgency(null, { at });
  for (const slot of slots) {
    const next = classifyDeliveryUrgency(parseDateOnly(slot.deadline), { at });
    if (URGENCY_RANK[next.urgency] < URGENCY_RANK[worst.urgency]) {
      worst = next;
    }
  }
  return worst;
}

export function zdFulfillmentSlotsTooltip(slots: MyOrderZdFulfillmentSlot[]): string {
  return slots
    .map((slot) => {
      const date = formatPlDate(slot.deadline);
      const count = slot.count > 1 ? ` · ${slot.count} prod.` : "";
      return `${date} · ${slot.dokNr}${count}`;
    })
    .join("\n");
}

export function salesZdGroupTimingLabel(
  slots: MyOrderZdFulfillmentSlot[],
  overdue: boolean
): string {
  if (slots.length <= 1) {
    const slot = slots[0]!;
    const overdueSuffix = overdue ? " · po terminie" : "";
    return `do ${formatPlDate(slot.deadline)} · ${slot.dokNr}${overdueSuffix}`;
  }

  const sorted = [...slots].sort((a, b) => {
    const da = parseDateOnly(a.deadline);
    const db = parseDateOnly(b.deadline);
    if (da && db) return da.getTime() - db.getTime();
    return a.deadline.localeCompare(b.deadline);
  });
  const dates = sorted.map((s) => formatPlDate(s.deadline));
  const uniqueDates = [...new Set(dates)];
  const overdueSuffix = overdue ? " · po terminie" : "";

  if (uniqueDates.length === 1) {
    return `do ${uniqueDates[0]} · ${sorted.length} poz.${overdueSuffix}`;
  }
  if (sorted.length === 2) {
    return `2 terminy: ${uniqueDates[0]} i ${uniqueDates[uniqueDates.length - 1]}${overdueSuffix}`;
  }
  return `${sorted.length} terminy: od ${uniqueDates[0]}${overdueSuffix}`;
}

export function zdFulfillmentGroupOverdue(slots: MyOrderZdFulfillmentSlot[]): boolean {
  return slots.some((slot) => {
    const d = parseDateOnly(slot.deadline);
    return d != null && isPastExpectedDate(d);
  });
}
