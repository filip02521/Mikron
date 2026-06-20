import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  buildDeliveryDateMetaDisplay,
  resolveMyOrderHistoryDeliveryEstimate,
} from "@/lib/orders/delivery-date-meta-label";
import { buildInformacjaTimingMetaDisplay } from "@/lib/orders/informacja-timing-meta";
import { shouldShowMyOrderCollapsedDeliveryTiming } from "@/lib/orders/my-order-delivery-timing-display";
import { parseDateOnly } from "@/lib/orders/dates";

/** Czytelna etykieta terminu na wąskim ekranie — spójna z meta po prawej na desktopie. */
export function formatCollapsedDeliveryTimingLabel(
  row: Pick<MyOrderRow, "kind" | "timingLabel" | "zdFulfillment">
): string | null {
  const informacjaRaw = row.timingLabel?.trim();
  if (row.kind === "informacja" && informacjaRaw) {
    const informacja = buildInformacjaTimingMetaDisplay(informacjaRaw);
    if (informacja) {
      return `${informacja.caption} · ${informacja.dateLabel}`;
    }
  }

  const zdDeadline = row.zdFulfillment?.deadline?.trim();
  if (zdDeadline) {
    const parsed = parseDateOnly(zdDeadline);
    if (parsed) {
      const display = buildDeliveryDateMetaDisplay(parsed);
      return display.detailLabel
        ? `${display.primaryLabel} · ${display.detailLabel}`
        : display.primaryLabel;
    }
  }

  const raw = row.timingLabel?.trim();
  if (!raw || /^E-mail\s/i.test(raw)) return null;

  const historyEstimate = resolveMyOrderHistoryDeliveryEstimate(row);
  if (!historyEstimate) return null;

  const display = historyEstimate.display;
  if (display.detailLabel && display.primaryLabel !== display.detailLabel) {
    return `${display.primaryLabel} · ${display.detailLabel}`;
  }
  return display.primaryLabel;
}

/** Termin u dostawcy na wąskim ekranie — gdy nie ma go jeszcze w subline. */
export function myOrderCollapsedMobileTiming(
  row: MyOrderRow,
  opts: {
    expanded: boolean;
    showProgress: boolean;
    collapsedSubline: string | null;
  }
): string | null {
  if (opts.expanded || !opts.showProgress) return null;
  if (!shouldShowMyOrderCollapsedDeliveryTiming(row)) return null;

  const timing = formatCollapsedDeliveryTimingLabel(row);
  if (!timing) return null;

  const subline = opts.collapsedSubline?.trim();
  if (subline && (subline.includes(timing) || timing.includes(subline))) return null;

  const showTiming =
    row.headlineTone === "warning" ||
    row.headlineTone === "stock" ||
    (row.headlineTone === "info" && row.statusTitle === "Zamówione") ||
    row.kind === "informacja";

  return showTiming ? timing : null;
}
