import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

/** Termin u dostawcy na wąskim ekranie — gdy nie ma go jeszcze w subline. */
export function myOrderCollapsedMobileTiming(
  row: MyOrderRow,
  opts: {
    expanded: boolean;
    showProgress: boolean;
    collapsedSubline: string | null;
  }
): string | null {
  if (opts.expanded || !opts.showProgress || !row.timingLabel?.trim()) return null;

  const timing = row.timingLabel.replace(/\s*·\s*po terminie\s*/i, "").trim();
  if (!timing) return null;

  const subline = opts.collapsedSubline?.trim();
  if (subline && (subline.includes(timing) || timing.includes(subline))) return null;

  const showTiming =
    row.headlineTone === "warning" ||
    row.headlineTone === "stock" ||
    (row.headlineTone === "info" && row.statusTitle === "Zamówione");

  return showTiming ? timing : null;
}
