import type { ZdEstimateOptionalColumn } from "@/lib/orders/zd-estimate-prefs";

/**
 * Liczba komórek w wierszu tabeli szacunku (dla spacerów wirtualizacji).
 * Pin: check + symbol + name + [pack] + doZd + opcjonalne + spacer + actions.
 */
export function countZdEstimateTableColumns(input: {
  showPackagingColumn: boolean;
  visibleOptionalColumns: readonly ZdEstimateOptionalColumn[];
}): number {
  let n = 6; // check, symbol, name, doZd, spacer, actions
  if (input.showPackagingColumn) n += 1;
  for (const col of input.visibleOptionalColumns) {
    if (col === "packaging") continue;
    if (col === "stock" || col === "zk") n += 2;
    else n += 1;
  }
  return n;
}

type ScrollToTwId = (twId: number) => boolean;

let virtualScrollToTwId: ScrollToTwId | null = null;

/** Workbench rejestruje scrollToIndex gdy tbody jest wirtualizowany. */
export function registerZdEstimateVirtualScrollToTwId(fn: ScrollToTwId | null) {
  virtualScrollToTwId = fn;
}

export function tryZdEstimateVirtualScrollToTwId(twId: number): boolean {
  return virtualScrollToTwId?.(twId) ?? false;
}
