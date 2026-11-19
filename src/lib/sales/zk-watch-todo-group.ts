import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { allZkWatchLinesCheckboxChecked } from "@/lib/sales/zk-watch-line-ui-state";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { filterZkWatchProductLineViewsForScope } from "@/lib/sales/zk-watch-prosba-scope";
import { groupZkWatchesByMonth, type ZkWatchMonthGroup } from "@/lib/sales/zk-watch-sort";
import type { SalesZkWatch } from "@/types/database";

export const ZK_TODO_GROUP_KEY = "todo";
export const ZK_TODO_GROUP_LABEL = "Do zrobienia";

/**
 * ZK, przy którym handlowiec ma coś do zrobienia: pozycja bez prośby, towar do odbioru
 * z regału, potwierdzona dostępność, przypomnienie po terminie albo sprawa do zamknięcia.
 * Te same sygnały, z których karta ZK buduje odznaki i główny przycisk.
 */
export function zkWatchNeedsAction(
  watch: SalesZkWatch,
  hints: ZkWatchOrderHints | undefined,
  referenceMs?: number
): boolean {
  if ((hints?.uncoveredLineKeys?.length ?? 0) > 0) return true;
  if ((hints?.regalWaitingLineKeys?.length ?? 0) > 0) return true;
  if ((hints?.informacjaReadyLineKeys?.length ?? 0) > 0) return true;
  if (isFollowUpDue(watch.follow_up_at, referenceMs)) return true;

  const lineViews = buildZkWatchLineViews(watch);
  const scoped = filterZkWatchProductLineViewsForScope(lineViews, watch, { showAllLines: false });
  return allZkWatchLinesCheckboxChecked({
    lineViews: scoped,
    newLineKeys: [],
    inStockLineKeys: hints?.inStockLineKeys ?? [],
    informacjaReadyLineKeys: hints?.informacjaReadyLineKeys ?? [],
    informacjaAcknowledgedLineKeys: hints?.informacjaAcknowledgedLineKeys ?? [],
    scopeExcludedLineKeys: hints?.scopeExcludedLineKeys ?? [],
    lineCoverageByKey: hints?.lineCoverageByKey,
  });
}

/** Lista ZK: najpierw grupa „Do zrobienia”, pod nią pozostałe ZK po miesiącach. */
export function groupZkWatchesForList(
  watches: SalesZkWatch[],
  hintsByWatchId: Map<string, ZkWatchOrderHints> | undefined,
  options?: { archived?: boolean; referenceMs?: number }
): ZkWatchMonthGroup[] {
  if (options?.archived) return groupZkWatchesByMonth(watches, options.referenceMs);

  const todo: SalesZkWatch[] = [];
  const rest: SalesZkWatch[] = [];
  for (const watch of watches) {
    (zkWatchNeedsAction(watch, hintsByWatchId?.get(watch.id), options?.referenceMs) ? todo : rest).push(watch);
  }

  const months = groupZkWatchesByMonth(rest, options?.referenceMs);
  if (todo.length === 0) return months;

  const todoSorted = groupZkWatchesByMonth(todo, options?.referenceMs).flatMap((group) => group.watches);
  return [{ key: ZK_TODO_GROUP_KEY, label: ZK_TODO_GROUP_LABEL, watches: todoSorted }, ...months];
}
