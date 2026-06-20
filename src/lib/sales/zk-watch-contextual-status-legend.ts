import {
  ZK_WATCH_LINE_FLOW_ORDER,
  ZK_WATCH_LINE_STATUS_LEGEND,
  ZK_WATCH_STATUS_GUIDE_ITEMS,
  zkWatchLineUiStateMeta,
  type ZkWatchLineUiState,
  type ZkWatchLineUiStateCounts,
} from "@/lib/sales/zk-watch-line-ui-state";

const STATUS_HINTS = new Map<ZkWatchLineUiState, string>(
  [...ZK_WATCH_LINE_STATUS_LEGEND, ...ZK_WATCH_STATUS_GUIDE_ITEMS].map((item) => [
    item.state,
    item.hint,
  ])
);

/** Legenda tylko ze statusów obecnych w bieżącym ZK — bez przytłaczania pełną listą. */
export function buildContextualZkWatchStatusLegend(
  counts: ZkWatchLineUiStateCounts
): { state: ZkWatchLineUiState; hint: string }[] {
  return ZK_WATCH_LINE_FLOW_ORDER.filter((state) => counts[state] > 0).map((state) => ({
    state,
    hint: STATUS_HINTS.get(state) ?? zkWatchLineUiStateMeta(state).label,
  }));
}
