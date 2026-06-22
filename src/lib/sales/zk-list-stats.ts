import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import {
  filterZkWatchProductLineViewsForScope,
  hasZkWatchTrackedProsbaScope,
} from "@/lib/sales/zk-watch-prosba-scope";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

function countTrackedProductLines(watch: SalesZkWatch): number {
  const views = buildZkWatchLineViews(watch);
  if (hasZkWatchTrackedProsbaScope(watch)) {
    return filterZkWatchProductLineViewsForScope(views, watch, { showAllLines: false }).length;
  }
  return views.filter((line) => line.key !== "summary").length;
}

export function summarizeZkWatchList(
  watches: SalesZkWatch[],
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>
): {
  watchCount: number;
  lineCount: number;
  regalLineCount: number;
  informacjaReadyLineCount: number;
} {
  let lineCount = 0;
  let regalLineCount = 0;
  let informacjaReadyLineCount = 0;

  for (const watch of watches) {
    lineCount += countTrackedProductLines(watch);
    const hints = zkHintsByWatchId?.get(watch.id);
    if (hints) {
      regalLineCount += hints.regalWaitingLineKeys.length;
      informacjaReadyLineCount += hints.informacjaReadyLineKeys?.length ?? 0;
    }
  }

  return {
    watchCount: watches.length,
    lineCount,
    regalLineCount,
    informacjaReadyLineCount,
  };
}
